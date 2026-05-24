-- =====================================================================
-- GROGU — Schema Additions v3
-- Run in Supabase SQL Editor (single paste → Run).
-- Tables are grogu_ prefixed — safe alongside your existing Notion app tables.
--
-- INTEGRATION MODEL:
-- GROGU tables are SEPARATE from notion_workspaces.data (JSONB).
-- DO NOT write GROGU data into the JSONB blob — race conditions + fragility.
-- Instead: every GROGU table has a workspace_id FK to notion_workspaces(id).
-- Your custom Notion UI reads from grogu_ tables directly via Supabase queries.
-- RLS reuses your existing helper functions (private.is_workspace_member etc.)
-- n8n writes to grogu_ tables via the service role key (bypasses RLS).
-- =====================================================================

-- Extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================================
-- HELPER: resolve GROGU workspace for the founder
-- Call once after setup. Returns the workspace_id GROGU should write to.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.grogu_workspace_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- Returns the workspace where the authenticated user is owner
  -- In production this will always be the founder's primary workspace
  SELECT id FROM public.notion_workspaces
  WHERE owner = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- =====================================================================
-- 1. grogu_voice_notes — every WhatsApp voice note
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_voice_notes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source
  whatsapp_message_id  TEXT UNIQUE,
  audio_duration_sec   INT,

  -- Transcription
  transcript           TEXT NOT NULL,

  -- Classifier output
  intent               TEXT CHECK (intent IN ('idea','problem','kpi','milestone','todo','decision','log')),
  business             TEXT CHECK (business IN ('churns','xalt','both','personal')),
  tldr                 TEXT,
  key_points           JSONB DEFAULT '[]',
  numbers_captured     JSONB DEFAULT '{}',
  action_items         JSONB DEFAULT '[]',
  content_potential    TEXT CHECK (content_potential IN ('high','medium','low','n/a')) DEFAULT 'n/a',

  -- Flags
  recurring_theme      BOOLEAN DEFAULT FALSE,
  content_attempted    BOOLEAN DEFAULT FALSE,
  founder_reply_sent   TEXT
);

ALTER TABLE public.grogu_voice_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read voice notes" ON public.grogu_voice_notes
  FOR SELECT USING (private.is_workspace_member(workspace_id));
-- n8n uses service role key → bypasses RLS for writes. No insert policy needed for service role.

CREATE INDEX idx_wvn_workspace_created ON public.grogu_voice_notes (workspace_id, created_at DESC);
CREATE INDEX idx_wvn_intent             ON public.grogu_voice_notes (workspace_id, intent);
CREATE INDEX idx_wvn_business           ON public.grogu_voice_notes (workspace_id, business);
CREATE INDEX idx_wvn_content            ON public.grogu_voice_notes (workspace_id, content_potential)
  WHERE content_potential IN ('high','medium');

-- Realtime (your Notion UI can listen for new voice notes live)
ALTER PUBLICATION supabase_realtime ADD TABLE public.grogu_voice_notes;

-- =====================================================================
-- 2. grogu_kpi_log — append-only metric history
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_kpi_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id     UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_for     DATE NOT NULL DEFAULT CURRENT_DATE,
  business         TEXT CHECK (business IN ('churns','xalt')),
  metric           TEXT NOT NULL,
  value_numeric    NUMERIC,
  value_text       TEXT,
  source           TEXT, -- 'voice_note', 'manual', 'sheet_import'
  source_voice_note_id UUID REFERENCES public.grogu_voice_notes(id)
);

ALTER TABLE public.grogu_kpi_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read kpi log" ON public.grogu_kpi_log
  FOR SELECT USING (private.is_workspace_member(workspace_id));

CREATE INDEX idx_wkl_metric_date ON public.grogu_kpi_log (workspace_id, business, metric, recorded_for DESC);

-- View: latest value per metric per business
CREATE OR REPLACE VIEW public.grogu_v_latest_kpi AS
SELECT DISTINCT ON (workspace_id, business, metric)
  workspace_id, business, metric, value_numeric, value_text, recorded_for, recorded_at
FROM public.grogu_kpi_log
ORDER BY workspace_id, business, metric, recorded_for DESC, recorded_at DESC;

-- View: week-to-date totals
CREATE OR REPLACE VIEW public.grogu_v_kpi_wtd AS
SELECT
  workspace_id,
  business,
  metric,
  SUM(value_numeric)  AS wtd_total,
  COUNT(*)            AS entry_count
FROM public.grogu_kpi_log
WHERE recorded_at >= date_trunc('week', NOW())
GROUP BY workspace_id, business, metric;

-- =====================================================================
-- 3. grogu_kpi_targets — editable thresholds (per workspace)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_kpi_targets (
  workspace_id     UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  metric           TEXT NOT NULL,
  business         TEXT NOT NULL CHECK (business IN ('churns','xalt')),
  period           TEXT CHECK (period IN ('daily','weekly','monthly')),
  green_threshold  NUMERIC NOT NULL,
  amber_min        NUMERIC NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, metric, business, period)
);

ALTER TABLE public.grogu_kpi_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read targets" ON public.grogu_kpi_targets
  FOR SELECT USING (private.is_workspace_member(workspace_id));
CREATE POLICY "editors can update targets" ON public.grogu_kpi_targets
  FOR ALL USING (private.can_edit_workspace(workspace_id));

-- Function to seed targets for a new GROGU workspace
CREATE OR REPLACE FUNCTION public.grogu_seed_kpi_targets(p_workspace_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Churns Bible §11 weekly thresholds
  INSERT INTO public.grogu_kpi_targets VALUES
    (p_workspace_id, 'audit_calls',   'churns', 'weekly', 5,   2, NOW()),
    (p_workspace_id, 'dms_received',  'churns', 'weekly', 10,  4, NOW()),
    (p_workspace_id, 'posts_shipped', 'churns', 'weekly', 10,  5, NOW()),
    (p_workspace_id, 'new_clients',   'churns', 'monthly', 2,  1, NOW()),
    -- XALT Bible §07 weekly thresholds
    (p_workspace_id, 'influencer_outreach', 'xalt', 'weekly', 20,  10, NOW()),
    (p_workspace_id, 'waitlist_growth',     'xalt', 'weekly', 500, 200, NOW()),
    (p_workspace_id, 'boxes_sold',          'xalt', 'weekly', 225, 100, NOW())
  ON CONFLICT DO NOTHING;
END;
$$;

-- =====================================================================
-- 4. grogu_milestones — $100M ladder (both businesses, per workspace)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_milestones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  business        TEXT CHECK (business IN ('churns','xalt')),
  code            TEXT,         -- M1, M2... / X1, X2...
  title           TEXT,
  target_metric   TEXT,
  target_value    NUMERIC,
  target_date     DATE,
  status          TEXT CHECK (status IN ('upcoming','active','hit','missed','dropped')) DEFAULT 'upcoming',
  hit_at          TIMESTAMPTZ,
  hit_value       NUMERIC,
  notes           TEXT
);

ALTER TABLE public.grogu_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read milestones" ON public.grogu_milestones
  FOR SELECT USING (private.is_workspace_member(workspace_id));
CREATE POLICY "editors can manage milestones" ON public.grogu_milestones
  FOR ALL USING (private.can_edit_workspace(workspace_id));

-- Function to seed milestones for a new GROGU workspace
CREATE OR REPLACE FUNCTION public.grogu_seed_milestones(p_workspace_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.grogu_milestones
    (workspace_id, business, code, title, target_metric, target_value, target_date, status)
  VALUES
    -- Churns AI ladder (Bible §10)
    (p_workspace_id,'churns','M1','RM 10K MRR',  'mrr_rm',    10000,  '2026-06-30','active'),
    (p_workspace_id,'churns','M2','RM 25K MRR',  'mrr_rm',    25000,  '2026-07-31','upcoming'),
    (p_workspace_id,'churns','M3','RM 50K MRR',  'mrr_rm',    50000,  '2026-08-31','upcoming'),
    (p_workspace_id,'churns','M4','RM 100K MRR', 'mrr_rm',    100000, '2026-12-31','upcoming'),
    (p_workspace_id,'churns','M5','RM 250K MRR', 'mrr_rm',    250000, '2027-03-31','upcoming'),
    (p_workspace_id,'churns','M6','RM 1M MRR',   'mrr_rm',    1000000,'2027-06-30','upcoming'),
    -- XALT ladder (XALT Bible §04 + §07)
    (p_workspace_id,'xalt','X1','Launch Aug 16',     'launch_event', NULL,   '2026-08-16','active'),
    (p_workspace_id,'xalt','X2','10K waitlist',       'waitlist',     10000,  '2026-08-16','active'),
    (p_workspace_id,'xalt','X3','900 boxes sold Q3',  'boxes_sold',   900,    '2026-09-30','upcoming'),
    (p_workspace_id,'xalt','X4','RM 208K rev 2026',   'revenue_rm',   208000, '2026-12-31','upcoming'),
    (p_workspace_id,'xalt','X5','RM 1M rev 2027',     'revenue_rm',   1000000,'2027-12-31','upcoming')
  ON CONFLICT DO NOTHING;
END;
$$;

-- =====================================================================
-- 5. grogu_bible_checks — decision quality audit log
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_bible_checks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_type      TEXT CHECK (check_type IN ('idea','decision')),
  input_text      TEXT,
  business        TEXT,
  verdict         TEXT CHECK (verdict IN ('clear','conflict','soft','killed')),
  conflicts       JSONB DEFAULT '[]',
  founder_override BOOLEAN DEFAULT FALSE,
  override_reason  TEXT,
  source_voice_note_id UUID REFERENCES public.grogu_voice_notes(id)
);

ALTER TABLE public.grogu_bible_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read bible checks" ON public.grogu_bible_checks
  FOR SELECT USING (private.is_workspace_member(workspace_id));

-- =====================================================================
-- 6. grogu_bible_sections — bible text for contradiction checks (seed once)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_bible_sections (
  id           TEXT PRIMARY KEY,   -- e.g. 'churns_no_build', 'xalt_never_do'
  workspace_id UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  bible        TEXT CHECK (bible IN ('churns','xalt')),
  section      TEXT,               -- '§13', '§15', 'operating_principles'
  title        TEXT,
  content      TEXT                -- full text of the section, pasted from bible
);

ALTER TABLE public.grogu_bible_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read bible sections" ON public.grogu_bible_sections
  FOR SELECT USING (private.is_workspace_member(workspace_id));
CREATE POLICY "editors can manage bible sections" ON public.grogu_bible_sections
  FOR ALL USING (private.can_edit_workspace(workspace_id));

-- =====================================================================
-- 7. grogu_todos — running task list
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_todos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title        TEXT NOT NULL,
  business     TEXT CHECK (business IN ('churns','xalt','both','personal')),
  priority     INT CHECK (priority BETWEEN 1 AND 5) DEFAULT 3,
  status       TEXT CHECK (status IN ('open','done','dropped','rolled')) DEFAULT 'open',
  due_date     DATE,
  done_at      TIMESTAMPTZ,
  rolled_count INT DEFAULT 0,
  source_voice_note_id UUID REFERENCES public.grogu_voice_notes(id)
);

ALTER TABLE public.grogu_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read todos" ON public.grogu_todos
  FOR SELECT USING (private.is_workspace_member(workspace_id));
CREATE POLICY "editors can manage todos" ON public.grogu_todos
  FOR ALL USING (private.can_edit_workspace(workspace_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.grogu_todos;

-- =====================================================================
-- 8. grogu_decisions_log — locked decisions + reversal triggers
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_decisions_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id     UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  decided_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business         TEXT CHECK (business IN ('churns','xalt','both','personal')),
  decision         TEXT NOT NULL,
  why_locked       TEXT,
  reversal_trigger TEXT,
  status           TEXT CHECK (status IN ('locked','revisited','reversed')) DEFAULT 'locked',
  bible_check_id   UUID REFERENCES public.grogu_bible_checks(id),
  source_voice_note_id UUID REFERENCES public.grogu_voice_notes(id)
);

ALTER TABLE public.grogu_decisions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read decisions" ON public.grogu_decisions_log
  FOR SELECT USING (private.is_workspace_member(workspace_id));
CREATE POLICY "editors can manage decisions" ON public.grogu_decisions_log
  FOR ALL USING (private.can_edit_workspace(workspace_id));

-- =====================================================================
-- 9. grogu_content_calendar — drafts → approved → published
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_content_calendar (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business     TEXT,
  platform     TEXT CHECK (platform IN ('linkedin','instagram','threads','x','xiaohongshu','newsletter')),
  destination  TEXT,  -- 'founder', 'churns', 'xalt'
  format       TEXT,
  draft_text   TEXT,
  source_voice_note_id UUID REFERENCES public.grogu_voice_notes(id),
  status       TEXT CHECK (status IN ('draft','approved','published','scrapped')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_url TEXT
);

ALTER TABLE public.grogu_content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read content" ON public.grogu_content_calendar
  FOR SELECT USING (private.is_workspace_member(workspace_id));
CREATE POLICY "editors can manage content" ON public.grogu_content_calendar
  FOR ALL USING (private.can_edit_workspace(workspace_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.grogu_content_calendar;

-- =====================================================================
-- 10. grogu_weekly_reviews — Monday Bible review archive
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_weekly_reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  churns_score    INT CHECK (churns_score BETWEEN 1 AND 10),
  xalt_score      INT CHECK (xalt_score BETWEEN 1 AND 10),
  churns_mrr      NUMERIC,
  xalt_waitlist   INT,
  cash_position   NUMERIC,
  runway_weeks    NUMERIC,
  full_text       TEXT,
  recurring_themes JSONB DEFAULT '[]',
  ideas_triaged   JSONB DEFAULT '[]',
  UNIQUE (workspace_id, week_start)
);

ALTER TABLE public.grogu_weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read weekly reviews" ON public.grogu_weekly_reviews
  FOR SELECT USING (private.is_workspace_member(workspace_id));

-- =====================================================================
-- 11. grogu_conversation_log — all WhatsApp messages in/out
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_conversation_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction     TEXT CHECK (direction IN ('inbound','outbound')),
  message_type  TEXT CHECK (message_type IN ('text','voice','image','system')),
  content       TEXT,
  workflow_name TEXT,
  tokens_in     INT,
  tokens_out    INT,
  related_voice_note_id UUID REFERENCES public.grogu_voice_notes(id)
);

ALTER TABLE public.grogu_conversation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read conversation log" ON public.grogu_conversation_log
  FOR SELECT USING (private.is_workspace_member(workspace_id));

CREATE INDEX idx_wcl_ts ON public.grogu_conversation_log (workspace_id, ts DESC);

-- =====================================================================
-- 12. grogu_daily_journal — general yapping + mood signals
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.grogu_daily_journal (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.notion_workspaces(id) ON DELETE CASCADE,
  journal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_voice_note_id UUID REFERENCES public.grogu_voice_notes(id),
  tldr         TEXT,
  mood_signal  TEXT CHECK (mood_signal IN ('high','mid','low','burnt')),
  sleep_hours  NUMERIC,
  UNIQUE (workspace_id, journal_date, source_voice_note_id)
);

ALTER TABLE public.grogu_daily_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read journal" ON public.grogu_daily_journal
  FOR SELECT USING (private.is_workspace_member(workspace_id));

-- =====================================================================
-- VIEWS
-- =====================================================================

-- Open todos, priority order
CREATE OR REPLACE VIEW public.grogu_v_open_todos AS
SELECT workspace_id, business, priority, title, due_date, rolled_count, created_at
FROM public.grogu_todos
WHERE status = 'open'
ORDER BY workspace_id, priority ASC, due_date ASC NULLS LAST, created_at ASC;

-- Week pace vs targets with status (used in W3 morning brief, W4 EOD, W9 mid-week check)
CREATE OR REPLACE VIEW public.grogu_v_week_pace AS
SELECT
  kpi.workspace_id,
  kpi.business,
  kpi.metric,
  COALESCE(kpi.wtd_total, 0)  AS wtd_total,
  t.green_threshold,
  t.amber_min,
  CASE
    WHEN COALESCE(kpi.wtd_total, 0) >= t.green_threshold THEN 'green'
    WHEN COALESCE(kpi.wtd_total, 0) >= t.amber_min       THEN 'amber'
    ELSE 'red'
  END AS status
FROM public.grogu_kpi_targets t
LEFT JOIN public.grogu_v_kpi_wtd kpi
  ON kpi.workspace_id = t.workspace_id
  AND kpi.business = t.business
  AND kpi.metric   = t.metric
WHERE t.period = 'weekly';

-- Active milestones with computed gap (used in W8, W11 next-best-action)
CREATE OR REPLACE VIEW public.grogu_v_active_milestones AS
SELECT
  m.workspace_id,
  m.business,
  m.code,
  m.title,
  m.target_metric,
  m.target_value,
  m.target_date,
  EXTRACT(DAY FROM (m.target_date::TIMESTAMPTZ - NOW()))::INT  AS days_remaining,
  lk.value_numeric                                             AS current_value,
  m.target_value - COALESCE(lk.value_numeric, 0)              AS gap_to_target
FROM public.grogu_milestones m
LEFT JOIN public.grogu_v_latest_kpi lk
  ON lk.workspace_id = m.workspace_id
  AND lk.business    = m.business
  AND lk.metric      = m.target_metric
WHERE m.status = 'active';

-- Recurring problems (3+ voice notes, same topic, last 14 days)
CREATE OR REPLACE VIEW public.grogu_v_recurring_problems AS
SELECT
  workspace_id,
  business,
  tldr,
  COUNT(*) AS mention_count,
  MAX(created_at) AS last_mention
FROM public.grogu_voice_notes
WHERE intent = 'problem'
  AND created_at > NOW() - INTERVAL '14 days'
GROUP BY workspace_id, business, tldr
HAVING COUNT(*) >= 3
ORDER BY mention_count DESC;

-- Unused high-potential content seeds
CREATE OR REPLACE VIEW public.grogu_v_content_seeds AS
SELECT workspace_id, id, business, tldr, content_potential, created_at
FROM public.grogu_voice_notes
WHERE content_potential IN ('high','medium')
  AND content_attempted = FALSE
  AND intent = 'idea'
ORDER BY workspace_id,
  CASE content_potential WHEN 'high' THEN 1 ELSE 2 END,
  created_at DESC;

-- =====================================================================
-- ONE-TIME SETUP FUNCTION
-- Run after schema is deployed. Finds the founder's workspace and seeds it.
-- Call: SELECT public.grogu_setup();  (while logged in as founder)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.grogu_setup()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT public.grogu_workspace_id() INTO v_workspace_id;
  IF v_workspace_id IS NULL THEN
    RETURN 'ERROR: no workspace found for current user. Create a workspace in your Notion app first.';
  END IF;

  PERFORM public.grogu_seed_kpi_targets(v_workspace_id);
  PERFORM public.grogu_seed_milestones(v_workspace_id);

  RETURN 'GROGU seeded for workspace: ' || v_workspace_id::text;
END;
$$;

-- =====================================================================
-- n8n ENVIRONMENT VARIABLE TO ADD
-- In n8n Settings → Variables, add:
--   GROGU_WORKSPACE_ID = [your workspace uuid]
-- Get it by running: SELECT public.grogu_workspace_id();
-- Every n8n Supabase node injects this as the workspace_id column value.
-- =====================================================================

-- =====================================================================
-- DONE.
-- After running this file:
-- 1. Run: SELECT public.grogu_setup();   ← seeds targets + milestones
-- 2. Run: SELECT public.grogu_workspace_id();  ← copy the UUID
-- 3. Add GROGU_WORKSPACE_ID to n8n environment variables
-- 4. Seed grogu_bible_sections manually (paste §13, §15, XALT §01 content)
-- =====================================================================
