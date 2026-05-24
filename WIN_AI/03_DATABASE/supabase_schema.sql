-- WIN AI — Supabase Schema
-- Run this in Supabase SQL Editor in order. Top to bottom. One file.
-- Postgres 15+ (Supabase default).

-- =====================================================================
-- 0. Extensions
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- fuzzy text search for theme detection
CREATE EXTENSION IF NOT EXISTS "vector";   -- semantic search across voice notes (Notion fallback)

-- =====================================================================
-- 1. Voice notes — the heart of WIN AI
-- =====================================================================
CREATE TABLE voice_notes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source
  whatsapp_message_id TEXT UNIQUE,
  audio_url          TEXT,
  audio_duration_sec INT,

  -- Whisper output
  transcript         TEXT NOT NULL,
  transcript_lang    TEXT DEFAULT 'en',

  -- Classifier output
  intent             TEXT CHECK (intent IN ('idea','problem','kpi','milestone','todo','decision','log')),
  business           TEXT CHECK (business IN ('churns','xalt','personal','cross')),
  tldr               TEXT,
  key_points         JSONB,         -- array of strings
  numbers_captured   JSONB,         -- object
  action_items       JSONB,         -- array of strings
  decision_logged    TEXT,
  content_potential  TEXT CHECK (content_potential IN ('high','medium','low','n/a')),

  -- Status
  recurring_theme    BOOLEAN DEFAULT FALSE,
  content_attempted  BOOLEAN DEFAULT FALSE,
  content_published  BOOLEAN DEFAULT FALSE,
  founder_reply_sent TEXT,
  founder_reply_at   TIMESTAMPTZ,

  -- For semantic search & theme recurrence
  embedding          VECTOR(1536)   -- optional, populate later if needed
);

CREATE INDEX idx_voice_notes_created ON voice_notes (created_at DESC);
CREATE INDEX idx_voice_notes_intent ON voice_notes (intent);
CREATE INDEX idx_voice_notes_business ON voice_notes (business);
CREATE INDEX idx_voice_notes_content_potential ON voice_notes (content_potential)
  WHERE content_potential IN ('high','medium');
CREATE INDEX idx_voice_notes_tldr_trgm ON voice_notes USING gin (tldr gin_trgm_ops);

-- =====================================================================
-- 2. Todos — running task list
-- =====================================================================
CREATE TABLE todos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  title           TEXT NOT NULL,
  business        TEXT CHECK (business IN ('churns','xalt','personal','cross')),
  priority        INT  CHECK (priority BETWEEN 1 AND 5),  -- 1 = today's top
  status          TEXT CHECK (status IN ('open','done','dropped','rolled')) DEFAULT 'open',

  source_voice_note_id UUID REFERENCES voice_notes(id),
  due_date        DATE,
  done_at         TIMESTAMPTZ,
  rolled_count    INT DEFAULT 0       -- how many times this rolled to next day
);

CREATE INDEX idx_todos_status_priority ON todos (status, priority);
CREATE INDEX idx_todos_due_date ON todos (due_date) WHERE status = 'open';

-- =====================================================================
-- 3. KPI log — every metric update
-- =====================================================================
CREATE TABLE kpi_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_for    DATE NOT NULL,  -- which date this metric applies to

  business        TEXT CHECK (business IN ('churns','xalt','personal','cross')),
  metric          TEXT NOT NULL,   -- 'mrr', 'waitlist', 'ig_followers', 'boxes_sold', etc.
  value_numeric   NUMERIC,
  value_text      TEXT,            -- when metric is non-numeric

  source          TEXT,             -- 'voice_note', 'sheet_import', 'manual'
  source_voice_note_id UUID REFERENCES voice_notes(id),
  notes           TEXT
);

CREATE INDEX idx_kpi_log_metric_date ON kpi_log (business, metric, recorded_for DESC);

-- =====================================================================
-- 4. Milestones — $100M ladder progress
-- =====================================================================
CREATE TABLE milestones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business        TEXT CHECK (business IN ('churns','xalt')),
  code            TEXT,            -- 'M1','M2',...
  title           TEXT,
  target_metric   TEXT,            -- 'mrr_rm'
  target_value    NUMERIC,
  target_date     DATE,
  status          TEXT CHECK (status IN ('upcoming','active','hit','missed','dropped')) DEFAULT 'upcoming',
  hit_at          TIMESTAMPTZ,
  hit_value       NUMERIC,
  notes           TEXT
);

INSERT INTO milestones (business, code, title, target_metric, target_value, target_date, status) VALUES
  ('churns', 'M1', 'RM 10K MRR', 'mrr_rm', 10000, '2026-06-30', 'active'),
  ('churns', 'M2', 'RM 25K MRR', 'mrr_rm', 25000, '2026-07-31', 'upcoming'),
  ('churns', 'M3', 'RM 50K MRR', 'mrr_rm', 50000, '2026-08-31', 'upcoming'),
  ('churns', 'M4', 'RM 100K MRR', 'mrr_rm', 100000, '2026-12-31', 'upcoming'),
  ('churns', 'M5', 'RM 250K MRR', 'mrr_rm', 250000, '2027-03-31', 'upcoming'),
  ('churns', 'M6', 'RM 1M MRR', 'mrr_rm', 1000000, '2027-06-30', 'upcoming'),
  ('xalt', 'X1', 'Launch Event Aug Week 2', 'launch_event', NULL, '2026-08-16', 'active'),
  ('xalt', 'X2', '900 boxes sold Q3', 'boxes_sold_q3', 900, '2026-09-30', 'upcoming'),
  ('xalt', 'X3', '10K waitlist captured', 'waitlist', 10000, '2026-08-16', 'active'),
  ('xalt', 'X4', 'RM 208K revenue 2026', 'revenue_rm_yr', 208000, '2026-12-31', 'upcoming'),
  ('xalt', 'X5', 'RM 1M revenue 2027', 'revenue_rm_yr', 1000000, '2027-12-31', 'upcoming');

-- =====================================================================
-- 5. Decisions log — Churns Bible Locked Decision pattern
-- =====================================================================
CREATE TABLE decisions_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business        TEXT CHECK (business IN ('churns','xalt','personal','cross')),

  decision        TEXT NOT NULL,
  why_locked      TEXT,
  reversal_trigger TEXT,           -- "if X happens, revisit"
  status          TEXT CHECK (status IN ('locked','revisited','reversed')) DEFAULT 'locked',
  source_voice_note_id UUID REFERENCES voice_notes(id)
);

-- =====================================================================
-- 6. Ideas vault — high-signal content seeds
-- =====================================================================
CREATE TABLE ideas_vault (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  business        TEXT CHECK (business IN ('churns','xalt','personal','cross')),
  tldr            TEXT NOT NULL,
  full_summary    JSONB,
  content_potential TEXT CHECK (content_potential IN ('high','medium','low')),
  source_voice_note_id UUID REFERENCES voice_notes(id),

  -- Lifecycle
  content_drafted BOOLEAN DEFAULT FALSE,
  content_published BOOLEAN DEFAULT FALSE,
  publish_platform TEXT,
  publish_url     TEXT
);

CREATE INDEX idx_ideas_vault_potential ON ideas_vault (content_potential, captured_at DESC)
  WHERE content_potential IN ('high','medium') AND content_published = FALSE;

-- =====================================================================
-- 7. Problems log — pattern detection
-- =====================================================================
CREATE TABLE problems_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business        TEXT CHECK (business IN ('churns','xalt','personal','cross')),
  tldr            TEXT NOT NULL,
  topic_keywords  TEXT[],          -- for fuzzy matching across mentions
  source_voice_note_id UUID REFERENCES voice_notes(id),
  resolved_at     TIMESTAMPTZ,
  resolution      TEXT
);

CREATE INDEX idx_problems_topic_gin ON problems_log USING gin (topic_keywords);

-- =====================================================================
-- 8. Daily journal — general yapping logs
-- =====================================================================
CREATE TABLE daily_journal (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  source_voice_note_id UUID REFERENCES voice_notes(id),
  tldr            TEXT,
  mood_signal     TEXT,            -- optional: 'high', 'mid', 'low', 'burnt'
  sleep_hours     NUMERIC          -- optional, if mentioned
);

CREATE INDEX idx_daily_journal_date ON daily_journal (journal_date DESC);

-- =====================================================================
-- 9. Conversation history — every message in/out of WhatsApp
-- =====================================================================
CREATE TABLE conversation_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction       TEXT CHECK (direction IN ('inbound','outbound')),
  channel         TEXT DEFAULT 'whatsapp',
  message_type    TEXT CHECK (message_type IN ('text','voice','image','document','system')),
  content         TEXT,
  related_voice_note_id UUID REFERENCES voice_notes(id),
  workflow_name   TEXT,            -- which n8n workflow generated this (outbound)
  tokens_in       INT,
  tokens_out      INT
);

CREATE INDEX idx_conv_ts ON conversation_history (ts DESC);

-- =====================================================================
-- 10. Weekly reviews — Monday Bible review archive
-- =====================================================================
CREATE TABLE weekly_reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start      DATE NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Scored 1-10
  churns_score    INT,
  xalt_score      INT,
  personal_score  INT,

  -- Snapshots
  churns_mrr      NUMERIC,
  xalt_waitlist   INT,
  cash_position   NUMERIC,
  runway_weeks    NUMERIC,

  full_text       TEXT,
  recurring_themes JSONB
);

CREATE INDEX idx_weekly_reviews_week ON weekly_reviews (week_start DESC);

-- =====================================================================
-- 11. Content calendar — drafts + published
-- =====================================================================
CREATE TABLE content_calendar (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  business        TEXT,
  platform        TEXT CHECK (platform IN ('linkedin','instagram','threads','x','xiaohongshu','tiktok','newsletter')),
  destination_account TEXT,        -- 'founder','churns','xalt'
  format          TEXT,
  draft_text      TEXT,

  source_idea_id  UUID REFERENCES ideas_vault(id),
  source_voice_note_id UUID REFERENCES voice_notes(id),

  status          TEXT CHECK (status IN ('draft','approved','scheduled','published','scrapped')) DEFAULT 'draft',
  scheduled_for   TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  published_url   TEXT,
  performance_notes TEXT
);

-- =====================================================================
-- 12. RLS — keep it permissive for now (single user)
-- =====================================================================
-- Disable RLS on all WIN AI tables for now. WIN AI is a single-user system.
-- Re-enable + scope by user_id if you ever multi-tenant this (Churns case study time).
ALTER TABLE voice_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE todos DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE decisions_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE ideas_vault DISABLE ROW LEVEL SECURITY;
ALTER TABLE problems_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_journal DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar DISABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 13. Useful views
-- =====================================================================

-- Active todos by business, ranked by priority
CREATE OR REPLACE VIEW v_open_todos AS
SELECT business, priority, title, due_date, rolled_count, source_voice_note_id, created_at
FROM todos
WHERE status = 'open'
ORDER BY priority ASC, due_date ASC NULLS LAST, created_at ASC;

-- Recurring themes (problems mentioned 3+ times in last 14 days)
CREATE OR REPLACE VIEW v_recurring_problems AS
SELECT
  business,
  unnest(topic_keywords) AS topic,
  COUNT(*) AS mentions,
  MAX(logged_at) AS last_mention
FROM problems_log
WHERE logged_at > NOW() - INTERVAL '14 days'
  AND resolved_at IS NULL
GROUP BY business, unnest(topic_keywords)
HAVING COUNT(*) >= 3
ORDER BY mentions DESC;

-- Latest KPI value per metric per business
CREATE OR REPLACE VIEW v_latest_kpi AS
SELECT DISTINCT ON (business, metric)
  business, metric, value_numeric, value_text, recorded_for, recorded_at
FROM kpi_log
ORDER BY business, metric, recorded_for DESC, recorded_at DESC;

-- High-potential ideas not yet drafted
CREATE OR REPLACE VIEW v_unused_content_seeds AS
SELECT id, business, tldr, content_potential, captured_at
FROM ideas_vault
WHERE content_potential IN ('high','medium')
  AND content_drafted = FALSE
ORDER BY
  CASE content_potential WHEN 'high' THEN 1 WHEN 'medium' THEN 2 END,
  captured_at DESC;

-- =====================================================================
-- DONE.
-- =====================================================================
