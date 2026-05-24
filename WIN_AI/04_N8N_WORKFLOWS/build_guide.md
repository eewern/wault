# n8n Workflows — Complete Build Guide

11 workflows. Build in order. Each one builds on the previous.

> **Estimated build time** (for an n8n-fluent builder): 18-22 hours total (8 original + 3 new). For a beginner: 35-50 hours. Hire a Fiverr/Upwork builder — see `06_BUILDER_SPEC/fiverr_brief.md`.
>
> **Infrastructure note:** n8n is already hosted, WhatsApp number is registered, Supabase project exists. Start at Step 1 — API keys in n8n — not at server setup.

---

## Knowledge Base Architecture (READ THIS FIRST)

GROGU reads both strategy bibles **live from notionwern on every call** — no static prompts, no snapshots.

**How it works:**
- Both bibles live in notionwern: `churns_ai_bible` (32 pages) and `xalt_strategy` (16 pages)
- Every workflow that needs strategic context runs a **KB Reader Code Node** first
- The Code Node fetches only the relevant pages (not the full workspace every time)
- Clean text is extracted from all block types and injected into the Claude context
- When the founder updates any notionwern page, the next GROGU response reflects it immediately

**Full implementation:** See `04_N8N_WORKFLOWS/kb_reader.md` — contains the complete reusable Code Node, per-workflow query types, and token cost breakdown.

**Key numbers:**
- Strategy KB (core pages): ~6,100 tokens — injected into W2, W6, W11
- Decision KB (locked decisions + milestones only): ~1,443 tokens — injected into W10
- KPI KB (KPI + milestone pages): ~1,200 tokens — injected into W3, W4, W9
- Full KB (all pages, Monday only): ~15,000 tokens — W6 Monday review
- **Cost: less than $0.10/month in total for all KB reads**

**Builder note:** The KB Reader Code Node in `kb_reader.md` is copy-paste ready. Add it as the first node in any workflow that needs bible context. Change `QUERY_TYPE` at the top of the code to match the workflow.

---

## Environment variables to set first (n8n → Settings → Variables)

```
// --- Core I/O ---
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
ANTHROPIC_API_KEY
OPENAI_API_KEY
FOUNDER_WHATSAPP_NUMBER             // your personal WA number e.g. 60123456789
GROGU_TIMEZONE                      // Asia/Kuala_Lumpur

// --- Supabase (operational memory: KPIs, voice notes, milestones) ---
SUPABASE_URL
SUPABASE_SERVICE_KEY                // service role key — bypasses RLS for writes
GROGU_WORKSPACE_ID                  // your workspace UUID — run SELECT public.grogu_workspace_id() after schema deploy

// --- notionwern API (knowledge base + document output surface) ---
NOTIONWERN_BASE_URL                 // production URL of your notionwern API server
NOTIONWERN_API_TOKEN                // your WORKSPACE_API_TOKEN (set during API server startup)
NOTIONWERN_CHURNS_WS_ID             // workspace ID for Churns Bible in notionwern (e.g. "churns_ai_bible")
NOTIONWERN_XALT_WS_ID               // workspace ID for XALT Bible in notionwern
NOTIONWERN_GROGU_WS_ID              // workspace ID for GROGU's output documents (e.g. "grogu_ops")

// notionwern page IDs inside GROGU_OPS workspace (get these after running notionwern_setup.md)
NOTIONWERN_GROGU_TASK_BOARD_PAGE_ID // the single task board page GROGU updates in-place
NOTIONWERN_GROGU_JOURNAL_PAGE_ID    // parent page for daily journal entries
NOTIONWERN_GROGU_DECISIONS_PAGE_ID  // parent page for decision log
NOTIONWERN_GROGU_REVIEWS_PAGE_ID    // parent page for weekly reviews
NOTIONWERN_GROGU_KPI_PAGE_ID        // parent page for KPI snapshots

// --- Google Sheets ---
GSHEET_FINANCE_ID
```

### notionwern HTTP credential (add once, reuse in all HTTP nodes)
In n8n → Credentials → HTTP Header Auth:
- Name: `notionwern-api`
- Header name: `x-workspace-api-token`
- Header value: `{{ $env.NOTIONWERN_API_TOKEN }}`

### Standard patterns for notionwern calls (use these in every workflow)

**Read a bible workspace (for context injection):**
```javascript
// Node type: HTTP Request
// Method: GET
// URL: {{ $env.NOTIONWERN_BASE_URL }}/api/workspaces/{{ $env.NOTIONWERN_CHURNS_WS_ID }}/pages
// Credential: notionwern-api
// → returns pages array; iterate to get blocks for each page
// Extract text: pages[].blocks[].text (strip HTML tags for Claude context)
```

**Write a new document to notionwern:**
```javascript
// Node type: HTTP Request
// Method: POST
// URL: {{ $env.NOTIONWERN_BASE_URL }}/api/workspaces/{{ $env.NOTIONWERN_GROGU_WS_ID }}/pages
// Credential: notionwern-api
// Body:
{
  "title": "Weekly Review — {{ $now.format('YYYY-MM-DD') }}",
  "icon": "📊",
  "parentId": "{{ $env.NOTIONWERN_GROGU_REVIEWS_PAGE_ID }}",
  "blocks": [
    { "type": "heading", "level": 1, "text": "{{ title }}" },
    { "type": "callout", "icon": "🟡", "text": "{{ one_line_summary }}" },
    { "type": "divider" },
    { "type": "text", "text": "<p>{{ full_content }}</p>" }
  ]
}
```

**Update the task board (checklist, in-place):**
```javascript
// Node type: HTTP Request
// Method: PATCH
// URL: {{ $env.NOTIONWERN_BASE_URL }}/api/workspaces/{{ $env.NOTIONWERN_GROGU_WS_ID }}/pages/{{ $env.NOTIONWERN_GROGU_TASK_BOARD_PAGE_ID }}
// Credential: notionwern-api
// Body:
{
  "blocks": [
    {
      "type": "heading", "level": 2, "text": "Open Tasks — updated {{ $now.format('MMM D, HH:mm') }}"
    },
    {
      "type": "checklist",
      "items": {{ tasks_array }}
      // Each item: { "id": "i_uuid", "text": "task description", "done": false, "dueDate": "YYYY-MM-DD" }
    }
  ]
}
```

---

# Workflow 1 — Voice Ingestion 🎙️ (THE CORE)

**Trigger:** WhatsApp inbound message with `type=audio`
**Purpose:** transcribe → classify → summarise → store → reply
**Frequency:** real-time, every voice note founder sends

## Nodes (in order)

### Node 1: WhatsApp Trigger (Webhook)
- HTTP Method: POST
- Path: `/whatsapp-in`
- Add a Webhook URL → paste into Meta App Dashboard → WhatsApp → Configuration → Callback URL

### Node 2: IF — Is this a voice message?
- Condition: `{{ $json.entry[0].changes[0].value.messages[0].type }}` equals `audio`
- True → continue. False → exit (Workflow 2 handles text).

### Node 3: HTTP Request — Download audio from WhatsApp
- Method: GET
- URL: `https://graph.facebook.com/v18.0/{{ $json.entry[0].changes[0].value.messages[0].audio.id }}`
- Headers: `Authorization: Bearer {{ $env.WHATSAPP_ACCESS_TOKEN }}`
- → returns audio download URL

### Node 4: HTTP Request — Get audio binary
- Method: GET
- URL: `{{ $json.url }}` (from previous response)
- Headers: `Authorization: Bearer {{ $env.WHATSAPP_ACCESS_TOKEN }}`
- Response format: File

### Node 5: OpenAI — Whisper Transcribe
- Operation: `Create Transcription`
- Model: `whisper-1`
- File: from Node 4 binary
- Language: auto-detect (or set `en` + `ms` fallback)
- → output: `text` field

### Node 6: Anthropic — Voice Classifier
- Model: `claude-haiku-4-5-20251001`
- System prompt: paste full content of `01_SYSTEM_PROMPTS/voice_classifier.md` (THE PROMPT section)
- User: 
  ```
  {{ $node["Whisper Transcribe"].json.text }}
  ```
- Temperature: 0.3
- Max tokens: 800
- → output expected: strict JSON (see voice_classifier.md schema)

### Node 7: Function — Parse JSON
```javascript
const raw = $input.first().json.content[0].text;
const cleaned = raw.replace(/^```json\n?/,'').replace(/```$/,'').trim();
let parsed;
try { parsed = JSON.parse(cleaned); }
catch (e) {
  return [{ json: { parse_error: true, raw, error: e.message } }];
}
return [{ json: parsed }];
```

### Node 8: IF — Parse error?
- If `parse_error = true` → branch to Node 8a (send raw to founder + log)
- Else → continue

### Node 9: Supabase — Insert into grogu_voice_notes
- Operation: Insert
- Table: `grogu_voice_notes`
- Fields:
  ```
  workspace_id: {{ $env.GROGU_WORKSPACE_ID }}
  transcript: {{ $node["Whisper Transcribe"].json.text }}
  intent: {{ $json.intent }}
  business: {{ $json.business }}
  tldr: {{ $json.tldr }}
  key_points: {{ $json.key_points }}
  numbers_captured: {{ $json.numbers_captured }}
  action_items: {{ $json.action_items }}
  content_potential: {{ $json.content_potential }}
  founder_reply: {{ $json.founder_reply }}
  ```
- Save the returned `id` for next steps

### Node 10: Switch — Route by intent
Branches:
- `idea` → Node 10a (notionwern Ideas page + Supabase)
- `problem` → Node 10b (notionwern Problems page + recurrence check)
- `kpi` → Node 10c (Sheets append + grogu_kpi_log)
- `milestone` → Node 10d (grogu_milestones update)
- `todo` → Node 10e (notionwern Task Board + Supabase)
- `decision` → Node 10f → **W10 bible check fires here** → notionwern Decisions Log
- `log` → Node 10g (notionwern Daily Journal)

#### Node 10a: Idea → notionwern + Supabase
- **notionwern HTTP POST** to `{{ $env.NOTIONWERN_BASE_URL }}/api/workspaces/{{ $env.NOTIONWERN_GROGU_WS_ID }}/pages`
  ```json
  {
    "title": "💡 {{ $json.tldr }}",
    "icon": "💡",
    "parentId": "ideas_parent_page_id",
    "blocks": [
      { "type": "callout", "icon": "🏢", "text": "{{ $json.business }}" },
      { "type": "text", "text": "<p>{{ $json.key_points }}</p>" },
      { "type": "callout", "icon": "📌", "text": "content potential: {{ $json.content_potential }}" }
    ]
  }
  ```
- Supabase insert into `grogu_voice_notes` (already done in Node 9)

#### Node 10b: Problem → notionwern + recurrence check
- Query Supabase: `SELECT COUNT(*) FROM grogu_voice_notes WHERE workspace_id=$1 AND business=$2 AND intent='problem' AND created_at > NOW() - INTERVAL '14 days'`
- If count >= 2 → set recurring flag AND add to founder_reply: "3rd time this week — pattern detected"
- **notionwern HTTP POST** — create page under Problems section in GROGU workspace

#### Node 10c: KPI → Sheets + grogu_kpi_log
- Use `numbers_captured` from classifier output
- For each metric/value pair: append row to `Metrics_Log` tab in Google Sheet
- Supabase insert into `grogu_kpi_log`:
  ```
  workspace_id: {{ $env.GROGU_WORKSPACE_ID }}
  business: {{ $json.business }}
  metric: {{ metric_name }}
  value_numeric: {{ metric_value }}
  source: voice_note
  ```
- Special: if metric = `mrr` → recompute and augment founder_reply: "logged. churns mrr now RM {{new_total}}. {{milestone_status}}"

#### Node 10d: Milestone update
- If voice mentions a milestone code (`M1`, `X1`, etc.) → update `grogu_milestones` in Supabase
- If numeric value crosses `target_value` → status = `hit`, triggers W8

#### Node 10e: Todo → notionwern Task Board + Supabase
- Supabase insert into `grogu_todos`:
  ```
  workspace_id: {{ $env.GROGU_WORKSPACE_ID }}
  task: {{ $json.tldr }}
  business: {{ $json.business }}
  due_date: {{ parsed_due_date }}
  priority: 3
  ```
- **notionwern PATCH** task board page — append new checklist item:
  ```
  GET current task board blocks first → add new item to checklist → PATCH page with updated blocks
  ```

#### Node 10f: Decision → W10 Bible Check → notionwern Decisions Log
- **DO NOT write yet** — route to W10 bible check first
- W10 runs contradiction check against both bibles (see W10 spec)
- Only after W10 returns `clear` or `soft`: **notionwern HTTP POST** to Decisions page:
  ```json
  {
    "title": "Decision: {{ $json.tldr }} — {{ verdict }}",
    "icon": "⚡",
    "parentId": "{{ $env.NOTIONWERN_GROGU_DECISIONS_PAGE_ID }}",
    "blocks": [
      { "type": "callout", "icon": "{{ verdict_icon }}", "text": "{{ verdict }}: {{ conflict_summary }}" },
      { "type": "heading", "level": 2, "text": "Decision" },
      { "type": "text", "text": "<p>{{ full_transcript }}</p>" },
      { "type": "heading", "level": 2, "text": "Bible Check" },
      { "type": "text", "text": "<p>{{ bible_check_result }}</p>" }
    ]
  }
  ```
- Supabase insert into `grogu_decisions_log` and `grogu_bible_checks`

#### Node 10g: Daily Journal → notionwern
- Detect mood signal: if transcript contains "tired", "burnt", "rough", "drained" → mood_signal=`low`
- **notionwern HTTP POST** to today's journal page under the Daily Journal parent:
  ```json
  {
    "title": "{{ today_date }} — Journal",
    "icon": "📓",
    "parentId": "{{ $env.NOTIONWERN_GROGU_JOURNAL_PAGE_ID }}",
    "blocks": [
      { "type": "text", "text": "<p>{{ $json.tldr }}</p>" },
      { "type": "bullets", "items": [{ "id": "i_1", "text": "{{ key_point }}", "level": 0 }] }
    ]
  }
  ```
- Supabase insert into `grogu_daily_journal`

### Node 11: WhatsApp — Send founder reply
- To: `{{ $env.FOUNDER_WHATSAPP_NUMBER }}`
- Body: `{{ $json.founder_reply }}`

### Node 12: Supabase — Log conversation
- Insert into `conversation_history`: outbound, related_voice_note_id

---

# Workflow 2 — Text Chat 💬

**Trigger:** same WhatsApp webhook as Workflow 1, but `type=text`
**Purpose:** ad-hoc Q&A. Founder asks GROGU anything.

## Nodes

### Node 1: WhatsApp Trigger (reuse webhook from W1, route by message type)
### Node 2: IF — Is `type=text`?
### Node 3: HTTP Request — Pull Churns Bible from notionwern
- Method: GET
- URL: `{{ $env.NOTIONWERN_BASE_URL }}/api/workspaces/{{ $env.NOTIONWERN_CHURNS_WS_ID }}/pages`
- Credential: `notionwern-api`
- → returns all pages; follow up with GET on each page's blocks to extract text
- Strip HTML tags from block text for clean Claude context

### Node 3b: HTTP Request — Pull XALT Bible from notionwern
- Same pattern, `{{ $env.NOTIONWERN_XALT_WS_ID }}`

### Node 4: Function — Build context block
Pull and merge:
- Churns Bible text (from Node 3) — truncate to ~4K tokens if long
- XALT Bible text (from Node 3b) — truncate to ~4K tokens
- Last 5 voice notes summaries (Supabase: `SELECT tldr, intent, business, created_at FROM grogu_voice_notes WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 5`)
- Open todos top 5 (Supabase: `grogu_todos` WHERE done=false ORDER BY priority, due_date)
- Current cash, MRR, milestones (Supabase: `grogu_v_active_milestones` + `grogu_v_latest_kpi`)
- Last weekly review (Supabase: `grogu_weekly_reviews` ORDER BY week_start DESC LIMIT 1)
Build a context block ~8-12K tokens total.

### Node 5: Anthropic — Conversation
- Model: `claude-sonnet-4-6` (worth the extra cost for nuanced answers)
- System: full content of `01_SYSTEM_PROMPTS/grogu_master.md`
- User: 
  ```
  CURRENT STATE:
  {{ context_block }}
  
  FOUNDER MESSAGE:
  {{ message_text }}
  ```
- Temperature: 0.5
- Max tokens: 1000

### Node 5: WhatsApp — Send reply
### Node 6: Supabase — Log conversation

---

# Workflow 3 — Morning Brief 🌅

**Trigger:** Cron `0 9 * * *` (Asia/Kuala_Lumpur)

## Nodes

### Node 1: Cron Trigger
### Node 2a: HTTP Request — Pull week pace from Supabase
- Query: `SELECT * FROM grogu_v_week_pace WHERE workspace_id = '{{ $env.GROGU_WORKSPACE_ID }}'`
- → returns per-metric green/amber/red status for both businesses

### Node 2b: HTTP Request — Pull active milestones
- Query: `SELECT * FROM grogu_v_active_milestones WHERE workspace_id = '{{ $env.GROGU_WORKSPACE_ID }}'`

### Node 2c: Function — Build full context block
Pull EVERYTHING (parallel HTTP nodes where possible):
- Today's date, day of week, day of month
- Days to XALT launch (compute from X1 milestone target_date)
- Churns active milestone + gap_to_target (from grogu_v_active_milestones)
- XALT active milestone + gap_to_target
- Latest churns MRR (Supabase `grogu_v_latest_kpi`)
- XALT waitlist (latest)
- Week pace 🟢🟡🔴 per metric (from Node 2a)
- Cash position (latest Cash row in Google Sheet)
- 4-week burn avg (compute from Outflows tab)
- Today's calendar events (Google Calendar API)
- Open todos top 5 (Supabase `grogu_todos` WHERE done=false)
- Yesterday's EOD log (Supabase `grogu_daily_journal` WHERE journal_date = today-1)
- Recurring problems (Supabase `grogu_v_recurring_problems`)
- Last 3 voice note summaries (Supabase `grogu_voice_notes` LIMIT 3)

### Node 3: Anthropic — Generate brief
- Model: `claude-sonnet-4-6`
- System: full content of `01_SYSTEM_PROMPTS/morning_brief.md` (with context appended)
- Max tokens: 600

### Node 4: WhatsApp — Send
### Node 5: Supabase — Log

### Node 6: Wait 2 hours → IF no reply from founder → silent nudge (one only)
### Node 7: Wait 3 more hours → IF still no reply → log skipped, no further nudge

---

# Workflow 4 — EOD Check-in 🌙

**Trigger:** Cron `30 18 * * *`

Same pattern as Workflow 3, using `01_SYSTEM_PROMPTS/eod_checkin.md`.

Special: after sending, wait for voice note. When founder voice-notes back, Workflow 1 (voice ingestion) picks it up — link via timestamp (any voice note within 4hrs of EOD with intent=`log` is tagged `eod_response=true` in Supabase).

If no reply by 22:00 → soft close message + log skip. If 3 days in a row skip → flag in next 9am brief.

---

# Workflow 5 — Weekly Cashflow 💰

**Trigger:** Cron `0 17 * * 5` (Friday 17:00)

## Nodes
### Node 1: Cron
### Node 2: Google Sheets — Read multiple tabs
- Cash (last 7 days)
- Inflows (last 4 weeks + next 4 weeks)
- Outflows (last 4 weeks + next 4 weeks committed)
- Forecast_12wk
- Capex_XALT
- MRR_Churns

### Node 3: Function — Compute snapshot
Build the FINANCE SNAPSHOT block per `01_SYSTEM_PROMPTS/finance_advisor.md`.

### Node 4: Anthropic — Generate cashflow review
- Model: `claude-sonnet-4-6`
- System: full content of `01_SYSTEM_PROMPTS/finance_advisor.md` (Friday weekly review section)
- Max tokens: 800

### Node 5: WhatsApp — Send
### Node 6: Run alert triggers
Hard rules from finance_advisor.md (runway <4wk, late invoices, etc.) — these run AS WELL as the LLM review, sent separately if any trigger.

---

# Workflow 6 — Monday Bible Review 📕

**Trigger:** Cron `0 8 * * 1`

Same pattern as W3/W5, using `01_SYSTEM_PROMPTS/monday_bible_review.md`. Heaviest context build — pulls last 7 days of voice notes, KPI deltas, decisions, bible sections.

Stores generated review to Supabase `weekly_reviews` table + Notion `Weekly_review_log`.

---

# Workflow 7 — Content Generator ✍️

**Trigger:** Special command via WhatsApp text or voice note containing phrases:
- "turn that into a post"
- "draft a {linkedin/IG/threads/XHS} {post/carousel/reel}"
- "make content from {voice note ID or 'that idea'}"

## Nodes
### Node 1: WhatsApp Trigger
### Node 2: Detect intent (regex or Haiku micro-call)
### Node 3: Fetch source idea
- If "that idea" → most recent voice note with `content_potential=high`
- If specific ID → fetch from `ideas_vault`
- If from current voice → use this voice note

### Node 4: Anthropic — Generate content
- Model: `claude-sonnet-4-6`
- System: full content of `01_SYSTEM_PROMPTS/content_generator.md`
- Inject: source + platform + format

### Node 5: WhatsApp — Send draft + approval prompt
### Node 6: Wait for approval (sub-workflow)
- "ship" → save to `content_calendar` status=approved
- "edit X to Y" → regenerate
- "scrap" → mark voice note `content_attempted=true`
- "try alt" → regenerate with alternates

---

# Workflow 8 — Milestone Tracker 🎯

**Trigger:** Supabase webhook (or polling) on `kpi_log` inserts

## Nodes
### Node 1: Trigger on new kpi_log row
### Node 2: Function — Check if value crosses any active milestone target
### Node 3: IF milestone hit
- Update milestones table: status=hit, hit_at=NOW(), hit_value=value
- Send WhatsApp celebration (one sentence + next milestone preview):
  > "M1 closed. RM 10K MRR hit 5 days early. M2 (RM 25K) is open — 30 days, RM 14K to add. monday review will walk the path."
- Activate next milestone in sequence (status=upcoming → active)

### Node 4: IF milestone target deadline in <7 days AND not hit
- WhatsApp warning:
  > "M1 deadline in 5 days. RM 8.4K/10K. need RM 1.6K MRR added — 2 retainers @ RM 800+ each, or 1 retainer @ RM 1.6K+. doable. focus."

### Node 5: IF deadline passed AND not hit
- Per Churns Bible kill criteria — invoke decision flow:
  > "M1 deadline missed. Bible says: '0 paying clients by end of June → stop content, run 10 more calls.' you're not at 0, but you're past the line. decision required: extend M1 by 30 days OR pivot to M2 path. voice me which."

---

---

# Workflow 9 — Mid-Week KPI Pace Check 📊

**Trigger:** Cron `0 12 * * 3` (Wednesday 12:00pm, Asia/Kuala_Lumpur)
**Prompt:** `01_SYSTEM_PROMPTS/mid_week_kpi_check.md`

## Nodes
### Node 1: Cron trigger
### Node 2: Supabase — Query week-to-date KPIs (both businesses)
```sql
SELECT business, metric, SUM(value_numeric) AS wtd_total
FROM grogu_kpi_log
WHERE recorded_at >= date_trunc('week', NOW()) AND recorded_at < NOW()
GROUP BY business, metric;
```
### Node 3: Supabase — Query kpi_targets (weekly)
```sql
SELECT * FROM grogu_kpi_targets WHERE period = 'weekly';
```
### Node 4: Supabase — Active milestones
```sql
SELECT * FROM grogu_v_active_milestones;
```
### Node 5: Function — Build context block
- Merge wtd totals vs targets
- Compute status per metric: green / amber / red (based on 60% pace threshold by Wednesday)
- Compute overall status per business
- Pull open blockers from voice notes (last 7 days, intent=problem)
### Node 6: IF — Any red or amber metrics?
- If all green → short template ("clean week so far"), skip Sonnet call
- If any amber/red → Anthropic Sonnet with full `mid_week_kpi_check.md` prompt
### Node 7: WhatsApp — Send
### Node 8: Supabase — Log to grogu_conversation_log

---

# Workflow 10 — Decision Bible Check 📖

**Trigger:** Inside Workflow 1, after voice classifier returns `intent=decision`
**Prompt:** `01_SYSTEM_PROMPTS/decision_bible_check.md`

This is NOT a standalone workflow — it's a branch added inside W1.

## Where to insert in W1 (after Node 10 Switch → `decision` branch):

### Node 10f-1: Supabase — Fetch both Bible texts (chunked)
Load the key sections:
- Churns Bible §13 (No-Build List) — stored as text in Supabase `grogu_bible_sections` table (seed it once)
- Churns Bible §15 (Locked Decisions) — same
- XALT Bible §01 (Operating Principles + Never Do) — same

### Node 10f-2: Anthropic Sonnet — Decision Bible Check
- System: content of `01_SYSTEM_PROMPTS/decision_bible_check.md` (THE PROMPT section)
- User: `{{ $json.transcript }}`
- Temperature: 0.1 (deterministic — this needs to catch conflicts reliably)
- Parse JSON response

### Node 10f-3: IF — verdict = "conflict" or "soft"?
- `clear` → skip to Node 10f-6 (log immediately)
- `conflict` → Node 10f-4 (send alert, await response)
- `soft` → Node 10f-5 (log + note)

### Node 10f-4: WhatsApp — Send conflict alert → Wait for reply
- Send `founder_message` from JSON
- Supabase: insert bible_check row with `verdict=conflict`
- Set workflow waiting state (n8n wait node, 24hr timeout)
- On reply: route "override" / "reshape" / "kill" → log accordingly

### Node 10f-5: WhatsApp + Supabase — Log soft flag
- Send `founder_message`
- Log `verdict=soft` to grogu_bible_checks
- Continue to log decision

### Node 10f-6: Supabase — Log decision + bible check
- Insert to grogu_decisions_log
- Insert to grogu_bible_checks (verdict=clear)
- Insert to grogu_notion_entries (type='decision')
- Send 1-line confirm

### Bible sections table (seed once):
```sql
CREATE TABLE IF NOT EXISTS grogu_bible_sections (
  id TEXT PRIMARY KEY,
  bible TEXT,       -- 'churns' or 'xalt'
  section TEXT,     -- '§13', '§15', 'operating_principles'
  title TEXT,
  content TEXT
);

INSERT INTO grogu_bible_sections VALUES
('churns_no_build', 'churns', '§13', 'No-Build List',
'1. Generic chatbot with no workflow integration — commodity...
[full text from Churns Bible §13]'),
('churns_locked', 'churns', '§15', 'Locked Decisions D1-D10',
'D1: Primary audience: non-coders who are curious but stuck...
[full text from Churns Bible §15]'),
('xalt_principles', 'xalt', 'operating_principles', 'What We Will Never Do',
'Add sugar or artificial stimulants...
[full text from XALT Bible §01 never-do section]');
```

---

# Workflow 11 — Next Best Action 🎯

**Trigger:** Keyword detection inside W2 (text chat)
**Prompt:** `01_SYSTEM_PROMPTS/next_best_action.md`

## Where to insert in W2 (before Node 4 Conversation):

### Node 2a: Function — Keyword match
```javascript
const triggers = [
  /what should i do/i, /what('s| is) (next|the move)/i,
  /i('m| am) stuck/i, /help( me)?$/i, /where (should|do) i (start|focus)/i,
  /not sure what to/i, /highest leverage/i, /what do i (do|work on) (now|today|next)/i
];
const isNBA = triggers.some(p => p.test($input.first().json.message_text));
return [{ json: { ...$input.first().json, route_to_nba: isNBA } }];
```

### Node 2b: IF — `route_to_nba = true`?
- True → Node 2c (NBA context build)
- False → continue to standard W2 Conversation node

### Node 2c: Supabase — Build NBA context (both businesses)
```sql
-- Active milestones with gaps
SELECT * FROM grogu_v_active_milestones;

-- Week pace (both businesses)
SELECT * FROM grogu_v_week_pace;

-- Open todos
SELECT * FROM grogu_v_open_todos LIMIT 5;

-- Last action logged per business
SELECT business, tldr, created_at FROM grogu_voice_notes
WHERE intent IN ('kpi','milestone','todo')
ORDER BY created_at DESC LIMIT 4;

-- Cash position
SELECT value_numeric FROM grogu_kpi_log
WHERE metric = 'cash_total' ORDER BY recorded_at DESC LIMIT 1;
```
Also pull: current time → determine time_block (deep-work / admin / wind-down) from calendar rules.

### Node 2d: Anthropic Sonnet — Next Best Action
- System: content of `01_SYSTEM_PROMPTS/next_best_action.md`
- Full context block injected
- Max tokens: 400 (one recommendation, not a novel)

### Node 2e: WhatsApp — Send recommendation
### Node 2f: Wait for "yes" / "do it" reply → if detected, route back to W2 for execution

---

# Test plan (updated — all 11 workflows)

| Test | How | Pass |
|---|---|---|
| Voice round-trip | Send 30-sec voice note | Get summary + reply within 15 sec |
| Text chat | Ask "what's M1 status?" | Correct answer pulled from Supabase |
| Morning brief + pace signal | Trigger manually | Includes 🟢🟡🔴 pace line for both businesses |
| EOD + weekly totals | Trigger manually | Includes week running totals both businesses |
| Cashflow Friday | Manually trigger | Numbers correct, observations sensible |
| Content gen | Voice an idea, then "make a LinkedIn post" | Draft arrives, sounds like founder |
| Milestone hit | Insert kpi_log row crossing M1 target | Celebration + next milestone activates |
| Recurring problem | Send 3 voice notes about same blocker | Third one triggers pattern flag |
| **Mid-week check** | Reach Wednesday with posts=2, outreach=4 | W9 fires 12pm, both businesses in one message |
| **Bible conflict** | Voice "I'm building a generic chatbot" | W10 fires alert citing §13, logged with verdict=conflict |
| **Next best action** | Text "what should I do?" | W11 returns ONE recommendation tied to lagging milestone |
| **Ideas triage (Monday)** | Voice 3 ideas, wait for Monday review | Monday message includes keep/park/kill for all 3 |
| **Custom Notion sync** | GROGU logs a decision | Row visible in grogu_notion_entries table (your UI reads it) |

If any test fails: deactivate that workflow, fix, retest before re-activating.

---

# Activation order (updated)

**Week 1:** W1 + W2 (core I/O — voice + text)
**Week 2:** W3 + W4 + W8 (daily rhythms + milestone tracker)
**Week 3:** W9 + W10 + W11 (accountability layer — the new stuff)
**Week 4:** W5 + W6 (finance + Monday review)
**Week 5:** W7 (content generator)
**Week 6:** Tuning pass

Rule: activate each week's batch, run for 48+ hours, fix issues before the next week's batch.

Don't build 11 at once. You'll have no idea which one broke.
