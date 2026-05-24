# Notion Page Templates — Starter Content

Paste each block into the corresponding Notion page after you build the structure.

---

## 00_README

```markdown
# WIN AI Brain — README

This workspace is WIN AI's knowledge base. WIN AI reads from it. WIN AI writes to it.

## Editing rules
- ✅ You can edit anything in 02_Founder_OS, 05_Finance/Tax_calendar
- ✅ Bibles (📕 Churns + 📘 XALT) are read-only — change via versioned files in /Users/eewern/Downloads/files/
- ✅ Databases are append-only via WIN AI — you can manually edit rows but check with WIN AI first if it's mid-write
- ❌ Do NOT rename pages — n8n references them by name
- ❌ Do NOT delete the "WIN AI" integration connection from any page

## How to ask WIN AI to update this workspace
Voice note: "WIN, update Calendar_rules — no meetings before 10am on Wednesdays."
WIN replies with the proposed change. You confirm. Done.

## How WIN AI uses this
- Strategy questions → reads bibles + decisions logs
- Daily brief context → reads Founder_OS + open todos + active milestones
- Voice classifier → writes to Voice_Vault + appropriate business log
- Monday review → reads weekly_review_log for last 4 entries → spots patterns

## When something feels off
WIN AI may drift. Reset by editing `01_Identity_Tone` and asking WIN AI to re-read it.
```

---

## 01_Identity_Tone

```markdown
# WIN AI — Identity & Tone

This is WIN AI's master system prompt, mirrored from the file `01_SYSTEM_PROMPTS/win_ai_master.md`. Editing here is the authoritative source — WIN AI re-reads this every morning before the 9am brief.

## Current version: v1.0  (locked YYYY-MM-DD)

[Paste the full content of `01_SYSTEM_PROMPTS/win_ai_master.md` here]

## Tone changelog
| Date | Version | Change | Reason |
|---|---|---|---|
| YYYY-MM-DD | v1.0 | Initial | Build kickoff |

(Append rows here every time you tweak the prompt. Date + what changed + why. This becomes the most valuable IP in WIN AI.)
```

---

## 02_Founder_OS / Calendar_rules

```markdown
# Calendar Rules

WIN AI never schedules over these.

## Deep work hours
- [Fill in: e.g., 09:00 – 12:00 every weekday — no meetings, no calls]

## No-meeting days
- [Fill in: e.g., Wednesdays = deep work / no external meetings]

## Family / personal blocks
- [Fill in: e.g., Fridays 18:00+ — family. Sat morning — gym.]

## Daily cadence
- 07:30 — wake
- 09:00 — WIN AI brief
- 09:30 — first deep work block
- 12:30 — lunch (protect)
- ...
- 18:30 — WIN AI EOD
- 23:00 — phone off

## Hard limits
- Max 3 external calls / day
- Max 5 meetings / week
- 1 admin day every 14 days
```

> **Action**: edit this with your actual rules before Day 4 of Week 1.

---

## 02_Founder_OS / Energy_patterns

```markdown
# Energy Patterns

When WIN AI knows when you're sharp vs flat, it stops scheduling cognitive work in the wrong slot.

## High-energy hours
- [e.g., 09:00 - 11:30 = peak focus]
- [e.g., 16:00 - 17:30 = second wind]

## Low-energy zones
- [e.g., 14:00 - 15:30 = post-lunch dip. Use for admin only.]

## Sleep target
- [e.g., 7h. Below 6h → WIN AI flags it in next morning brief.]

## Signals WIN AI watches
- Voice note mood markers ("burnt", "drained", "tired")
- Days where 0/3 priorities shipped 2+ days in a row
- 3+ skipped EOD check-ins in a row

When any 2 of the above hit → WIN AI proposes a recovery day (no external calls, no content, just operations).
```

---

## 02_Founder_OS / Values_non-negotiables

```markdown
# Non-negotiables — Lines WIN AI Never Crosses

- Never schedule meetings during prayer / family / gym blocks
- Never push content that contradicts XALT Bible §01 brand DNA
- Never send any third-party message without explicit "send it" confirmation
- Never recommend a financial decision that breaks: "no owner withdrawals until RM 50K MRR stable"
- Never lie to me. If WIN AI doesn't know, WIN AI says so.
- Never pile on. If I've had a bad day, no extra load tomorrow morning beyond the 1 priority.

[Add yours.]
```

---

## 02_Founder_OS / Personal_goals_2026

```markdown
# Personal Goals 2026 (non-business)

## Health
- [e.g., Gym 3x/wk]
- [e.g., 7h sleep average / month]

## Family
- [e.g., 1 dedicated family dinner / wk]
- [e.g., Quarterly family trip]

## Learning
- [e.g., 1 book / month]
- [e.g., 1 course done / quarter]

## Money (personal, not business)
- [e.g., Set aside 10% of business net for personal savings starting Q3]

WIN AI ties these into Friday cashflow + Monday review checks. If business goals are eating personal goals 3 wks in a row → WIN AI flags it.
```

---

## 04_XALT / Launch_tracker

```markdown
# XALT Launch Tracker

**Launch event: August Week 2, 2026 (target: Sat Aug 16)**
**Status: T-minus [WIN AI fills in] days**

## Critical path

| # | Milestone | Owner | Target | Status | Notes |
|---|---|---|---|---|---|
| 1 | OEM batch confirmed | Founder | 2026-06-15 | 🟡 | 3rd delay logged — see Problems_log |
| 2 | Branding & packaging lock | Founder + designer | 2026-06-30 | 🟢 | Design in review wk of 6/16 |
| 3 | Influencer seeding — 10 nano | Founder | 2026-07-11 | ⚪ | List in Influencer_pipeline |
| 4 | Hero review videos live (3) | Influencer + founder | 2026-07-25 | ⚪ | |
| 5 | Waitlist hits 10,000 | Marketing | 2026-08-15 | ⚪ | Current: [fill] |
| 6 | DTC site live | Founder + dev | 2026-08-01 | ⚪ | |
| 7 | Shopee + Lazada listings live | Founder | 2026-08-10 | ⚪ | |
| 8 | Launch event venue confirmed | Founder | 2026-07-15 | ⚪ | |
| 9 | 900 boxes ready in warehouse | OEM | 2026-08-12 | ⚪ | |
| 10 | LAUNCH DAY | All | 2026-08-16 | ⚪ | |

## Knock-on risks
- If milestone 1 slips past 2026-06-30 → milestone 3 timeline tightens → influencer drop window narrows → launch must shift OR split-batch
- If milestone 5 (waitlist 10K) falls short by 20%+ → Q3 revenue target (RM 108K) at risk

WIN AI auto-updates Status based on voice notes mentioning these milestones.
```

---

## 05_Finance / Tax_calendar_MY

```markdown
# Malaysia Tax & Compliance Calendar

## Set-aside rule
- 20% of net business income → tax reserve (separate sub-account)
- Reviewed every Friday by WIN AI

## Key deadlines
| Date | What | Business |
|---|---|---|
| Apr 30 | Form B (personal income tax) for prior year | Founder |
| Apr 30 | Form BE (employed) — if applicable | Founder |
| Jul 31 | Form C (Sdn Bhd) — Churns if incorporated | Churns |
| Jul 31 | Form C — XALT if incorporated | XALT |
| Monthly by 15th | SST returns (if registered, >RM 500K threshold) | If applicable |
| Quarterly | EPF / SOCSO if hiring | When hiring |

## Current entity status
- Churns AI: [Sdn Bhd / Sole prop / Not registered yet]
- XALT: [Sdn Bhd / Sole prop / Not registered yet]

WIN AI flags deadlines 30 days out.
```

---

## 06_People / Investors_advisors

```markdown
# Investors & Advisors — XALT Capital Raise

## Active conversations
[Empty for now. Voice me names + intro context, I'll populate.]

## Target list (research)
[Empty for now. Voice me category preferences — angels? family offices? SEA VC? — I'll research and propose 20 to start.]

## Connectors who could intro
[Empty for now.]

## Pitch deck status
- [ ] One-pager
- [ ] 10-slide deck
- [ ] Data room (P&L, unit econ, GTM, team)
- [ ] FAQ doc

WIN AI tracks every conversation in Capital_raise_pipeline database. Friday cashflow review includes "where's the raise" line if status = active.
```

---

## 07_Daily_Log — Template

```markdown
# Daily Log — YYYY-MM-DD

(WIN AI writes here automatically at 18:30. Founder can voice-edit any field.)

## Morning priorities (set 09:00)
1. 
2. 
3. 

## Shipped
- 

## Slipped
- 

## Voice notes today
- [auto-linked]

## KPI updates today
- 

## Mood signal
- (high / mid / low / burnt)

## Tomorrow's 1 thing
- 

## Bible reference touched today
- [e.g., Churns Bible §05 (Verticals) — for property reframe]
```

---

> All of this is starter content. WIN AI fills most of it over time from your voice notes — you don't have to type anything ongoing except editing your founder OS pages when something changes (e.g., new deep-work block).
