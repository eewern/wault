# GROGU — Complete Build Package

**Your personal AI Chief of Staff for Churns AI + XALT → $100M ladder.**

Voice-first. WhatsApp-native. Blunt COO tone. Under USD $55/mo.

**Startup-phase accountability built in:** proactive KPI interventions, decision quality checks against both Bibles, on-demand next-best-action, weekly ideas triage. Not a passive secretary — an active COO.

---

## What's in this folder

```
WIN_AI/
├── README.md                          ← you are here
├── 00_SETUP/                          ← accounts + infra (do before builder starts)
│   ├── week_1_checklist.md            ← START HERE
│   ├── notionwern_setup.md            ← SET UP FIRST: GROGU workspace in notionwern + page IDs
│   ├── meta_whatsapp_setup.md         ← WhatsApp Cloud API approval
│   ├── hetzner_n8n_install.md         ← VPS + n8n install
│   ├── supabase_setup.md              ← database project
│   └── claude_whisper_keys.md         ← AI provider keys
├── 01_SYSTEM_PROMPTS/                 ← paste into n8n Claude nodes
│   ├── grogu_master.md                ← GROGU's identity (6 responsibilities)
│   ├── voice_classifier.md            ← 7-intent classifier
│   ├── morning_brief.md               ← 9am brief + week pace signal
│   ├── eod_checkin.md                 ← 6:30pm wrap-up + running weekly totals
│   ├── content_generator.md           ← voice→post pipeline
│   ├── finance_advisor.md             ← weekly cashflow + decisions
│   ├── milestone_tracker.md           ← $100M ladder notifications
│   ├── monday_bible_review.md         ← weekly strategy + ideas triage
│   ├── mid_week_kpi_check.md          ← Wednesday 12pm auto-intervention (W9)
│   ├── decision_bible_check.md        ← bible contradiction guard (W10)
│   └── next_best_action.md            ← "what should I do?" engine (W11)
├── 03_DATABASE/                       ← Supabase (operational memory only)
│   ├── supabase_schema.sql            ← original notionwern app schema
│   ├── schema_additions.sql           ← run this: grogu_ tables for KPIs, milestones, memory
│   └── schema_explained.md            ← what each table does
├── 04_N8N_WORKFLOWS/                  ← build in n8n
│   ├── build_guide.md                 ← step-by-step, all 11 workflows
│   └── workflow_specs/                ← per-workflow detail
├── 05_GOOGLE_SHEET/
│   └── finance_template.md            ← exact tab + formula spec
├── 06_BUILDER_SPEC/
│   └── fiverr_brief.md                ← one-page hire doc (RM 2-3K)
└── 07_OPERATIONS/
    ├── tone_examples.md               ← good/bad GROGU responses
    ├── kill_criteria.md               ← when to scrap & rebuild
    └── monthly_maintenance.md         ← what to tune each month
```

### Architecture in one picture

```
You (WhatsApp voice/text)
        │
        ▼
   n8n workflows
        │
        ├──→ Claude API (Haiku for routine, Sonnet for strategy)
        ├──→ OpenAI Whisper (voice transcription)
        │
        ├── READ ──→ notionwern API
        │            ├── Churns AI Bible workspace
        │            └── XALT Bible workspace
        │
        ├── WRITE ─→ notionwern API (GROGU OPS workspace)
        │            ├── Weekly Reviews (every Monday)
        │            ├── Daily Journal (every evening)
        │            ├── Decision Log (every decision + bible check)
        │            ├── KPI Snapshots (Wednesday + milestone events)
        │            ├── Ideas Vault (every idea from voice)
        │            └── Task Board (live checklist, updated in-place)
        │
        └── READ/WRITE ──→ Supabase (grogu_ tables)
                           KPI history, voice note transcripts,
                           milestones, todos, conversation log
```

notionwern = your browser. Everything GROGU writes appears there automatically.

---

## Setup order (6 weeks — infra already done)

| Step | What | Who | Deliverable |
|---|---|---|---|
| **Before anything** | Run `00_SETUP/notionwern_setup.md` | YOU (15 min) | GROGU OPS workspace created. Bible workspaces confirmed. Page IDs noted. |
| **Before anything** | Run `schema_additions.sql` in Supabase SQL editor | YOU (5 min) | grogu_ tables live. Run `SELECT public.grogu_setup();` |
| Week 1 | All env vars in n8n | YOU (30 min) | All API keys + NOTIONWERN vars + GROGU_WORKSPACE_ID added |
| Week 2 | W1 + W2 (core I/O) | Builder | Voice round-trip + text chat working. notionwern writes confirmed. |
| Week 3 | W3 + W4 + W8 (daily rhythms) | Builder | Morning brief (with pace signal) + EOD (with totals) + milestone tracker live |
| Week 4 | **W9 + W10 + W11 (accountability layer)** | Builder | Mid-week check + bible guard + next best action live |
| Week 5 | W5 + W6 + W7 (finance + strategy + content) | Builder | Full system live |
| Week 6 | Tuning | YOU | Tone, prompt versions, kill criteria review |

---

## Cost summary

| Item | RM/mo | USD/mo |
|---|---|---|
| Hetzner CX22 VPS (Falkenstein) | 25 | 6 |
| Claude API (Haiku + Sonnet mix, low vol) | 110 | 25 |
| OpenAI Whisper (voice notes) | 60 | 14 |
| Dedicated WhatsApp SIM (Hotlink Prepaid) | 30 | 7 |
| Meta WhatsApp Cloud API | 0–20 | 0–5 |
| Supabase + Notion + Sheets | 0 | 0 |
| **TOTAL** | **~225–245** | **~$52–57** |

One-off setup: Fiverr/Upwork builder = RM 1,500–3,000 if you don't wire it yourself.

---

## The 11 workflows GROGU runs

**Core (W1–W8):**
1. **Voice ingestion** — Whisper → classify (7 intents) → store → reply
2. **Text chat** — WhatsApp Q&A grounded in bibles + memory
3. **Morning brief** — 9:00 daily + week pace signal (🟢🟡🔴 both businesses)
4. **EOD check-in** — 18:30 daily + running weekly totals
5. **Friday cashflow** — 17:00 weekly finance review
6. **Monday Bible review** — 08:00 ladder check + ideas triage (keep/park/kill)
7. **Content generator** — on-demand voice→post pipeline
8. **Milestone tracker** — event-driven, fires on every KPI update

**Startup accountability layer (W9–W11):**
9. **Mid-week KPI check** — Wednesday 12:00 automatic intervention if pace is off
10. **Decision Bible check** — fires inside W1 on every `decision` — checks both bibles before logging
11. **Next best action** — on-demand "what should I do?" → ONE recommendation

---

## Read these first, in this order

1. `00_SETUP/week_1_checklist.md`
2. `01_SYSTEM_PROMPTS/grogu_master.md`
3. `04_N8N_WORKFLOWS/build_guide.md`
4. `06_BUILDER_SPEC/fiverr_brief.md` (if hiring)

Everything else is reference — pull when you need it.

---

## Locked decisions (do not change without re-reading rationale)

| # | Decision | Why |
|---|---|---|
| WIN-D1 | Voice is the primary input | Founder's preferred input channel; captures highest-signal raw thinking |
| WIN-D2 | n8n self-host, not Make/Zapier | Cost (€5 vs €50+); same stack as Churns delivery → IP compounds |
| WIN-D3 | Claude as primary LLM (not GPT) | Better at tone-following; longer context for whole bibles |
| WIN-D4 | Supabase for memory, Notion for KB | Supabase = structured query; Notion = human-editable strategy docs |
| WIN-D5 | Bot drafts, founder approves anything irreversible | Cashflow decisions, sent messages, content posts — never autonomous |
| WIN-D6 | Tone: blunt COO + casual friend | Locked per founder feedback. See `07_OPERATIONS/tone_examples.md` |
| WIN-D7 | Every workflow → ChurnsOS Phase 0 library | Per Churns Bible Locked Decision D6. This build IS a case study. |

---

*Built for solo founder operating two businesses to $100M. If GROGU ever feels like a chatbot, you've drifted. Re-read `07_OPERATIONS/tone_examples.md`.*
