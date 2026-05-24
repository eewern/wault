# Notion Workspace Structure — "WIN AI Brain"

Build this exact tree in Notion. Page titles must match — n8n's Notion node references them by name.

```
WIN AI Brain  (top-level workspace or page)
│
├── 00_README                            (read-only guide for you + builders)
│
├── 01_Identity_Tone                     (WIN AI's editable system prompt + tone changelog)
│
├── 02_Founder_OS
│   ├── Calendar_rules                   (deep work hours, no-meeting days, family blocks)
│   ├── Energy_patterns                  (when you're sharpest, when you tank)
│   ├── Values_non-negotiables           (lines WIN AI must never cross)
│   ├── Personal_goals_2026              (health, family, learning — non-business)
│   └── Routines                         (morning, evening, weekly)
│
├── 03_Churns_AI
│   ├── 📕 Churns Bible v6                (paste the full markdown from 01_ChurnsAI_Bible_v6.md)
│   ├── 📄 60-Day Content Plan            (paste 02_ChurnsAI_Content_60_Days.md)
│   ├── 📄 Agent Architecture             (paste 03_ChurnsAI_Agent_Architecture.md)
│   ├── 📄 Customer Journey Audit         (paste 04_ChurnsAI_Customer_Journey_Audit.md)
│   ├── Active_clients                   (database — see schema below)
│   ├── Pipeline                          (database — leads + audit calls)
│   ├── Content_calendar                  (database)
│   ├── Decisions_log                     (database — only Churns-specific decisions)
│   ├── Ideas_vault                       (database — high-signal content seeds)
│   ├── Problems_log                      (database)
│   ├── Weekly_review_log                 (each Monday's review)
│   └── Case_studies                      (one page per shipped client)
│
├── 04_XALT
│   ├── 📘 XALT Bible 2026                (paste the docx-converted content)
│   ├── Launch_tracker                    (D-day countdown + critical path)
│   ├── OEM_status                        (live updates from voice notes)
│   ├── Influencer_pipeline               (database)
│   ├── Waitlist_metrics                  (linked from KPI log)
│   ├── Capital_raise_pipeline            (database — investors, status)
│   ├── Decisions_log                     (database)
│   ├── Ideas_vault                       (database)
│   ├── Problems_log                      (database)
│   └── Weekly_review_log
│
├── 05_Finance
│   ├── 🔗 Google Sheet — WIN AI Finance   (link block to the live sheet)
│   ├── Tax_calendar_MY                    (SST, income tax deadlines, set-aside %)
│   ├── Withdrawal_policy                  (currently: none — when reconsider, what trigger)
│   └── Banking_accounts                   (list — Maybank, CIMB, what's each for)
│
├── 06_People
│   ├── Customers_top20                    (database)
│   ├── Investors_advisors                 (database — XALT raise specifically)
│   ├── Contractors                        (database — current freelancers)
│   ├── Family_personal                    (database — birthdays, anniversaries WIN AI shouldn't miss)
│   └── Mentors_circle                     (who you talk to + last contact)
│
├── 07_Daily_Log                          (one page per day, WIN AI writes 18:30)
│
└── 08_Voice_Vault                        (cross-cutting voice-note archive)
    ├── Today (database view — last 24h)
    ├── This Week (database view — last 7d)
    ├── Content_Seeds (filtered view — content_potential = high)
    ├── All_Ideas (filtered view — intent = idea)
    └── Archive (filtered view — older than 30 days)
```

---

## Notion database schemas

Notion uses "databases" (like tables) — create these as inline databases inside the parent page.

### Active_clients (under 03_Churns_AI)
| Property | Type | Notes |
|---|---|---|
| Name | Title | Client name |
| Vertical | Select | clinic / property / creator / other |
| Tier | Select | starter / pro / group |
| MRR_RM | Number | Monthly retainer |
| Setup_fee_RM | Number | One-off |
| Start_date | Date | |
| Status | Select | active / paused / churned |
| Onboarding_status | Select | day-1 / week-1 / week-2 / live |
| Notes | Text | Last interaction signal |
| Source | Select | content / referral / inbound / outbound |

### Pipeline (under 03_Churns_AI)
| Property | Type | Notes |
|---|---|---|
| Lead name | Title | |
| Vertical | Select | clinic / property / creator / other |
| Stage | Select | dm / audit-booked / audit-done / proposal / decision / signed / lost |
| Audit_date | Date | |
| Proposal_value_RM | Number | |
| Last_touch | Date | |
| Source | Select | content / referral / inbound / outbound |
| Notes | Text | |

### Influencer_pipeline (under 04_XALT)
| Property | Type | Notes |
|---|---|---|
| Creator handle | Title | |
| Platform | Select | IG / XHS / TikTok / LinkedIn |
| Tier | Select | nano (<10K) / micro (10-100K) / macro (100K+) |
| Followers | Number | |
| Niche | Multi-select | run / yoga / pilates / wellness / desk / travel |
| Status | Select | researching / outreach-sent / chatting / sent-product / posted / declined |
| Outreach_date | Date | |
| Last_touch | Date | |
| Commission_% or Fee | Text | |
| Promo_code | Text | |

### Capital_raise_pipeline (under 04_XALT)
| Property | Type | Notes |
|---|---|---|
| Investor / Fund | Title | |
| Type | Select | angel / family-office / VC / strategic |
| Country | Select | MY / SG / ID / regional / global |
| Cheque_size_range_RM | Text | |
| Status | Select | researching / intro-pending / pitched / following-up / passed / committed |
| Last_touch | Date | |
| Connector | Text | Who connected you |
| Notes | Text | |

### Decisions_log (under each business)
| Property | Type | Notes |
|---|---|---|
| Decision | Title | |
| Date | Date | |
| Why_locked | Text | |
| Reversal_trigger | Text | What event re-opens this? |
| Status | Select | locked / revisited / reversed |
| Source | Text | "voice note 2026-05-21" or "weekly review" etc. |

### Ideas_vault (under each business)
| Property | Type | Notes |
|---|---|---|
| TLDR | Title | |
| Date_captured | Date | |
| Business | Select | churns / xalt / personal / cross |
| Content_potential | Select | high / medium / low |
| Drafted | Checkbox | |
| Published | Checkbox | |
| Platform | Select | linkedin / IG / threads / XHS |
| Publish_url | URL | |
| Full_summary | Text | The structured summary from voice classifier |

### Problems_log (under each business)
| Property | Type | Notes |
|---|---|---|
| TLDR | Title | |
| First_logged | Date | |
| Last_mentioned | Date | |
| Mention_count | Number | |
| Status | Select | open / actioned / resolved |
| Topic_keywords | Multi-select | For recurrence detection |
| Resolution_notes | Text | |

---

## Notion integration setup (so WIN AI can read/write)

1. Notion Settings → Connections → Develop or manage integrations → **+ New integration**
2. Name: `WIN AI` · Workspace: pick your workspace
3. Capabilities: ✓ Read content ✓ Update content ✓ Insert content ✓ No user info
4. Submit → copy the **Internal Integration Token** (starts with `secret_…`)
5. Save as `NOTION_INTEGRATION_TOKEN` in your n8n credentials
6. Open `WIN AI Brain` top page → "…" menu → Connections → Add → `WIN AI`
   - This grants WIN AI access to that page AND every sub-page

> Without step 6, WIN AI's API calls will return 404 "object not found". Most common Notion debugging mistake.

---

## Page IDs n8n needs (save these)

After building the workspace, you'll need each page's ID. To get one:
1. Open the page in Notion
2. Click "…" → Copy link
3. The URL ends with `…/<page-id>?...` — copy the 32-char hex string before `?`

Save these for n8n:

```
NOTION_ACTIVE_CLIENTS_DB_ID = ...
NOTION_PIPELINE_DB_ID = ...
NOTION_INFLUENCER_PIPELINE_DB_ID = ...
NOTION_CAPITAL_RAISE_DB_ID = ...
NOTION_DECISIONS_CHURNS_DB_ID = ...
NOTION_DECISIONS_XALT_DB_ID = ...
NOTION_IDEAS_CHURNS_DB_ID = ...
NOTION_IDEAS_XALT_DB_ID = ...
NOTION_PROBLEMS_CHURNS_DB_ID = ...
NOTION_PROBLEMS_XALT_DB_ID = ...
NOTION_DAILY_LOG_PARENT_ID = ...
NOTION_VOICE_VAULT_PARENT_ID = ...
NOTION_CONTENT_CALENDAR_DB_ID = ...
```

Set these as **Environment variables** in n8n (Settings → Variables) so workflows reference them cleanly: `{{ $env.NOTION_PIPELINE_DB_ID }}`.

---

## What WIN AI writes where

| Voice note intent | Writes to |
|---|---|
| idea | `Ideas_vault` (business-specific) + `08_Voice_Vault` |
| problem | `Problems_log` (business-specific) + `08_Voice_Vault` |
| kpi | (Supabase only — Notion view is via the Sheet) |
| milestone | `Active_clients` / `Pipeline` / `Launch_tracker` (update existing row) |
| todo | (Supabase `todos` table — Notion view via linked database) |
| decision | `Decisions_log` (business-specific) |
| log | `07_Daily_Log` (today's page) |

Every voice note ALSO writes the raw + summary to `08_Voice_Vault` as a master archive.

---

## Recommended Notion views (set these up once)

In `08_Voice_Vault`, create these saved views on the master database:

| View | Filter | Sort |
|---|---|---|
| Today | `Date_captured` = Today | newest first |
| This Week | `Date_captured` in last 7 days | newest first |
| Content Seeds 🔥 | `Content_potential` = high, `Drafted` = unchecked | newest first |
| Open Problems | `Intent` = problem, `Resolved` = unchecked | mention_count desc |
| Decisions | `Intent` = decision | newest first |
| Ideas (all) | `Intent` = idea | newest first |
| Yapping | `Intent` = log | newest first (collapsible) |
