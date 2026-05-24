# Fiverr / Upwork Builder Brief — GROGU

> **One-page brief.** Hand this to an n8n freelancer. Pay RM 2,000–3,000 one-off. Timeline: 2 weeks. Budget: RM 2,500 typical (11 workflows).

---

## Project: Build personal AI Chief of Staff "GROGU"

I have a complete spec already. Your job is to wire it up in **n8n self-hosted on Hetzner** (I'll have the VPS provisioned and n8n installed before you start).

---

## What you'll build

**11 n8n workflows** connecting:
- WhatsApp Business Cloud API (Meta) — primary I/O
- Anthropic Claude API (Haiku + Sonnet 4.5/4.6)
- OpenAI Whisper API (voice transcription)
- Supabase (Postgres — schema provided, already deployed)
- Google Sheets API (finance tracker — sheet provided)
- Google Calendar API (read-only)

> **No Notion API.** I run a custom-built Notion-like web app that uses the same Supabase project. GROGU writes to `grogu_` prefixed tables in Supabase — my custom UI reads them. You do not touch Notion.

Full prompts, schemas, workflow specs, and node-by-node guides are in the build folder I'll share.

---

## Deliverables

| # | Deliverable | Acceptance |
|---|---|---|
| 1 | Voice ingestion W1 (Whisper → Claude classify → Supabase write + WhatsApp reply) | Send voice notes in all 7 intents; all classify and store correctly to `grogu_voice_notes` |
| 2 | Text chat W2 + Next best action W11 | Ad-hoc Q&A works; "what should I do?" returns ONE recommendation tied to lagging milestone |
| 3 | Morning brief W3 (9am cron) | Brief arrives on schedule; includes 1-line pace signal: both businesses 🟢🟡🔴 |
| 4 | EOD check-in W4 (6:30pm cron) | Arrives on schedule; includes week running totals for both businesses |
| 5 | Friday cashflow W5 (5pm cron) | Pulls Sheet data, generates LLM review, sends |
| 6 | Monday Bible review W6 (8am Mon cron) | Long-context review includes ideas triage (Keep/Park/Kill), stored to Supabase |
| 7 | Content generator W7 (on-demand) | Draft → approve flow works end-to-end |
| 8 | Milestone tracker W8 (event-driven) | Hitting an MRR threshold triggers celebration + next milestone activation |
| 9 | Mid-week KPI check W9 (Wed 12pm cron) | Fires automatically; both businesses in one message with 🔴🟡🟢 and intervention prompt |
| 10 | Decision bible check W10 (inside W1) | When `intent=decision` classified, fires bible check before Supabase write; conflict returns alert to founder |
| 11 | Exported workflow JSON files (one per workflow) | Provided as ZIP for backup + future re-import |
| 12 | 30-min Loom walkthrough of the live system | Shows all 11 workflows firing on test data |
| 13 | 1 week of post-handover support (bug fixes only) | WhatsApp |

---

## I provide (before you start)

- Hetzner VPS with n8n running (login provided)
- All API keys pre-loaded in n8n credentials: Anthropic, OpenAI Whisper, WhatsApp Cloud API, Supabase (service role key), Google Sheets
- Complete Supabase schema (already deployed — `grogu_` tables + views live)
- Google Sheet (already structured — 7 tabs)
- Full system prompts (11 markdown files — one per workflow)
- Step-by-step n8n build guide with node-by-node specs
- Test plan with pass criteria

You shouldn't need to design anything — only implement.

---

## Critical: workspace_id requirement

Every Supabase write in every workflow **must include** the `workspace_id` column:

```
workspace_id: {{ $env.GROGU_WORKSPACE_ID }}
```

This is a non-negotiable. I'll provide the `GROGU_WORKSPACE_ID` value (a UUID) as an n8n environment variable before you start. Every single `INSERT` into any `grogu_` table must pass this value — it's the FK that links GROGU's data to my workspace. A workflow that writes to Supabase without `workspace_id` will fail silently and the data will be rejected by RLS.

**Do not skip this. It applies to every workflow, every node, every table.**

---

## Required skills

- n8n proficient (must have built 5+ production workflows)
- Comfortable with Claude API + structured JSON output (conditional branching on JSON fields is used extensively)
- Whisper / OpenAI API
- Postgres / Supabase basics (writes via service role key; RLS is bypassed server-side — do NOT use anon key for writes)
- WhatsApp Cloud API (must have configured webhooks before)

Notion API experience is NOT required or relevant for this project.

Send samples of previous n8n work in your application.

---

## Timeline

| Days | Milestone |
|---|---|
| 1-2 | W1 + W2 (voice round-trip + text chat) — show me working before proceeding |
| 3-4 | W3 + W4 + W8 (morning brief with pace signal, EOD with totals, milestone tracker) |
| 5-6 | W9 + W10 + W11 (mid-week check, decision bible check, next best action) |
| 7-8 | W5 + W6 (Friday cashflow + Monday Bible review with ideas triage) |
| 9-10 | W7 (content generator) |
| 11-12 | Test all 11 against the test plan |
| 13 | Loom walkthrough + handover |
| 14 | Bug fix buffer |

Daily check-in via WhatsApp (5 min, async). I'm available for clarifications same-day during MY working hours.

---

## Budget

- RM 2,500 fixed price (USD ~590) — increased from base spec to cover 11 workflows (was 8)
- 50% upfront, 50% on acceptance
- Test plan pass = acceptance trigger

Tighter timeline (1 week instead of 2) = +RM 800 rush fee.

---

## Hard rules

1. **No autonomous actions.** GROGU drafts; founder approves anything irreversible. Workflows must NOT auto-send to third parties, auto-pay, or auto-publish.
2. **Tone preserved.** The system prompts are exact. Do not "improve" them.
3. **No alternative LLMs.** Claude only. (Don't sub in GPT or Gemini "because it's cheaper" — has been considered, locked decision.)
4. **No Zapier / Make / Pipedream substitutions.** n8n only (per cost + IP-ownership requirements).
5. **All workflow JSONs delivered.** I own everything.
6. **workspace_id on every insert.** No exceptions. See "Critical: workspace_id requirement" above.
7. **Service role key for Supabase writes, never anon key.** The service role key bypasses RLS — that's intentional. n8n is the trusted backend. Do not use anon key for any write operation.
8. **W10 fires BEFORE Supabase write.** The decision bible check (W10) must intercept within W1, before any `grogu_decisions_log` insert. Order matters — do not log first, check second.

---

## To apply

Send:
1. 3 examples of n8n workflows you've built (screenshots or Loom)
2. A specific question about my brief that shows you read it
3. Your timeline commitment

I'll pick within 48 hours. First-week start.

---

## Bonus

If you build this well, I run an AI consultancy (Churns AI). I'll likely have follow-on n8n work — vertical-specific agent stacks for SEA clinics and creators. Good build here = first call on those.
