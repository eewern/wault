# Supabase Schema Explained

Plain-language walkthrough of what each table does and why it exists. Read once, reference later.

---

## voice_notes — the heart

Every WhatsApp voice note creates one row here. This is the canonical record of everything you say to GROGU.

**Why it matters:** in 6 months you can search: *"what was that idea about property audits I voiced in May?"* — GROGU does a full-text + semantic search across this table and surfaces it.

**Key columns:**
- `transcript` — raw Whisper output (don't edit, ever)
- `intent` — classifier's decision (one of 7)
- `business` — which business is this about
- `tldr` + `key_points` + `numbers_captured` — the structured summary
- `content_potential` — `high` means it should become a post
- `recurring_theme` — set true by Workflow 1 when topic appears 3+ times in 14 days

**Linked from:** every other domain table has a `source_voice_note_id` foreign key back here.

---

## todos — the running list

Every task that comes out of a voice note. Includes things you said ("remind me to chase Dr Lim") and things GROGU proposed and you approved.

**Lifecycle:**
- `open` → `done` (you said "shipped that")
- `open` → `dropped` (you said "actually never mind")
- `open` → `rolled` (didn't touch by end of day, rolls to tomorrow with `rolled_count++`)

When `rolled_count >= 3`, GROGU flags it in next morning brief: *"todo X has rolled 3 times. kill it or block tomorrow morning for it?"*

---

## kpi_log — the metrics timeline

Append-only. Every number you give GROGU lands here. MRR, waitlist, followers, boxes sold, audit calls, anything.

**Why append-only:** so you can graph the trajectory. View `v_latest_kpi` gives the most recent value per metric.

**Mirrors Google Sheet `Metrics_Log` tab** — both write in sync via Workflow 1 KPI branch. Sheet for human eyes, Supabase for queries.

---

## milestones — the $100M ladder

Pre-populated with all M1-M6 for Churns and X1-X5 for XALT (from the bibles). One active at a time per business.

**Workflow 8** watches `kpi_log` inserts. When a value crosses an active milestone target, it auto-flips status to `hit` and activates the next one.

You can manually update too: voice "extend M1 by 14 days" → GROGU updates `target_date`.

---

## decisions_log

Modeled after Churns Bible's "Locked Decisions" pattern. Captures every explicit decision you make.

**Why important:** in 6 months when you wonder *"why did I choose not to go after property as primary?"* — answer is here, with your own voice-note explanation captured at the time.

`reversal_trigger` is the special field — *"what event would re-open this decision?"* GROGU checks these monthly: if a trigger condition is met, she flags it. *"You logged in Feb: 'revisit property if Churns MRR > RM 100K'. We're there. Voice me your read."*

---

## ideas_vault

High-signal ideas, separated from yapping. Anything classifier tagged `intent=idea` lands here too.

**Filtered view `v_unused_content_seeds`** shows ideas tagged `content_potential=high|medium` that haven't been drafted yet — perfect for content fillers when you're running low.

---

## problems_log

Every blocker / frustration. Pattern detection lives here.

`topic_keywords` array is the key — populated by the classifier. When 3+ entries share a keyword within 14 days → `recurring_theme=true` propagates back to the latest `voice_note` row, which changes the founder_reply to flag the pattern.

---

## daily_journal

The general "yapping" bucket. One row per `intent=log` voice note.

`mood_signal` is the optional vibe tag (`high`/`mid`/`low`/`burnt`). If 3+ days of `low` in a row, Monday review picks it up and asks about scheduling.

---

## conversation_history

Every WhatsApp message in or out, with token counts and which workflow generated outbound messages.

**Why:** debugging ("why did GROGU say X at Y time?") + monthly cost analysis (token-counted per workflow).

---

## weekly_reviews

Monday Bible review outputs land here. One row per week.

**Compounds over time:** the 26th Monday review can reference the 1st. GROGU's pattern recognition gets sharper week over week.

---

## content_calendar

Drafts GROGU generates + their lifecycle:
- `draft` (just generated)
- `approved` (you said "ship")
- `scheduled` (queued in Buffer/Later — future v2)
- `published` (you posted, manually for now)
- `scrapped` (you said no)

Optional `performance_notes` field — paste view counts / engagement after publishing → over time you'll see which content seeds → posts → engagement. Closes the loop.

---

## The views

Saved queries for fast access in workflows.

| View | Purpose |
|---|---|
| `v_open_todos` | Morning brief pulls top 5 from here |
| `v_recurring_problems` | Monday review + 9am brief check this |
| `v_latest_kpi` | Every workflow that needs current numbers reads this |
| `v_unused_content_seeds` | Content generator queries this for "what's ripe to ship?" |

---

## Backups

Supabase free tier includes daily snapshots, kept 7 days. For longer:

1. Once a month, run `pg_dump` via Supabase CLI → save to local drive or Google Drive
2. Or set up a tiny n8n workflow: Cron monthly → Supabase query all tables to JSON → email to yourself

GROGU's memory is your IP. Don't lose it.

---

## Privacy note

Everything is on Supabase Singapore region. Standard encryption at rest. RLS disabled because single-user.

When you eventually multi-tenant this (turn it into a ChurnsOS product for other founders):
1. Add `user_id` column to every table
2. Re-enable RLS
3. Add policies: `user_id = auth.uid()`
4. Migrate existing rows with your fixed user_id

For now: single-tenant, simpler, faster.
