# Google Sheet — "WIN AI Finance" Template

Build this in Google Sheets (not Excel — n8n's Google Sheets node uses the Sheets API). One spreadsheet, 7 tabs.

---

## Tab 1: `Cash`

Daily snapshot of bank balances. You update once a day (or screenshot → WIN AI parses later).

| A: Date | B: Maybank (Churns) | C: CIMB (XALT) | D: Tax Reserve | E: Total | F: Notes |
|---|---|---|---|---|---|
| 2026-05-21 | 8200 | 5400 | 600 | =B2+C2+D2 | Dr Lim setup landed |
| 2026-05-22 | ... | ... | ... | =B3+C3+D3 | |

Column E formula: `=SUM(B2:D2)` — fill down.

**WIN AI reads:** latest row → `cash_position_rm`
**You log:** end of each day, or whenever a transfer hits

---

## Tab 2: `Inflows`

Every payment IN. One row per transaction.

| A: Date | B: Source | C: Business | D: Category | E: Amount RM | F: Status | G: Notes |
|---|---|---|---|---|---|---|
| 2026-05-21 | Dr Lim | Churns | Setup | 5000 | Cleared | New client |
| 2026-05-21 | Dr Lim | Churns | Retainer | 3000 | Cleared | Monthly |
| 2026-05-25 | Smile Clinic | Churns | Retainer | 2500 | Expected | Invoice sent 5/12 |
| 2026-06-01 | XALT pre-sale | XALT | DTC | 4800 | Expected | 40 boxes × RM 120 |

Categories (dropdown): `Setup` `Retainer` `One-off` `DTC` `Shopee` `B2B` `Refund` `Investor` `Other`

Status (dropdown): `Cleared` `Expected` `Late` `Bad debt`

**WIN AI reads:** filtered by date range for weekly/monthly summary
**You log:** when invoice goes out (Status=Expected) and again when cleared

---

## Tab 3: `Outflows`

Every payment OUT. One row per transaction.

| A: Date | B: Vendor | C: Business | D: Category | E: Amount RM | F: Status | G: Recurring? | H: Notes |
|---|---|---|---|---|---|---|---|
| 2026-05-18 | Hetzner | Both | SaaS | 25 | Paid | Monthly | n8n VPS |
| 2026-05-19 | Claude API | Both | SaaS | 110 | Paid | Monthly | |
| 2026-05-20 | OEM Manufacturer | XALT | COGS | 18000 | Paid | One-off | Batch 1 deposit |
| 2026-05-25 | Designer | XALT | Branding | 3500 | Expected | One-off | Packaging |

Categories (dropdown): `COGS` `SaaS` `Marketing` `Ads` `Branding` `Contractor` `Rent` `Utilities` `Travel` `Owner draw` `Tax payment` `Other`

Recurring (dropdown): `Monthly` `Weekly` `Quarterly` `One-off`

**WIN AI reads:** filtered for 4-week burn calc + upcoming committed outflows
**You log:** when bill received (Status=Expected) and when paid

---

## Tab 4: `Capex_XALT`

The RM 63–86K launch budget tracker. Tracks how much of the launch budget is spent.

| A: Item | B: Budget Low | C: Budget High | D: Spent | E: Remaining (mid) | F: Status | G: Notes |
|---|---|---|---|---|---|---|
| OEM (30K sachets, 2 flavours) | 36000 | 40000 | 18000 | =((B2+C2)/2)-D2 | In progress | Deposit paid |
| Branding & packaging | 5000 | 8000 | 3500 | =((B3+C3)/2)-D3 | In progress | |
| Influencer marketing + ads | 5000 | 10000 | 0 | =((B4+C4)/2)-D4 | Not started | |
| Launch event | 5000 | 8000 | 0 | =((B5+C5)/2)-D5 | Not started | |
| Promotions & sampling | 8000 | 12000 | 0 | =((B6+C6)/2)-D6 | Not started | |
| Merch | 3000 | 5000 | 0 | =((B7+C7)/2)-D7 | Not started | |
| E-commerce setup | 1500 | 3000 | 0 | =((B8+C8)/2)-D8 | Not started | |
| **TOTAL** | =SUM(B2:B8) | =SUM(C2:C8) | =SUM(D2:D8) | =SUM(E2:E8) | | |

**WIN AI reads:** `xalt_capex_budget`, `xalt_capex_spent`, `xalt_capex_remaining`
**You update:** as you commit to spends

---

## Tab 5: `MRR_Churns`

Client-by-client retainer + setup tracking.

| A: Client | B: Vertical | C: Setup RM | D: Monthly RM | E: Start | F: Status | G: Notes |
|---|---|---|---|---|---|---|
| Client 1 | Clinic | 3000 | 2500 | 2026-04-01 | Active | |
| Client 2 | Creator | 5000 | 5000 | 2026-04-15 | Active | |
| Dr Lim | Clinic | 5000 | 3000 | 2026-05-26 | Onboarding | |
| **TOTAL ACTIVE MRR** | | | =SUMIF(F:F,"Active",D:D) + SUMIF(F:F,"Onboarding",D:D) | | | |

**WIN AI reads:** cell with TOTAL ACTIVE MRR → `churns_mrr`

---

## Tab 6: `Forecast_12wk`

Rolling 12-week cashflow projection. The most important tab.

| A: Week of | B: Opening cash | C: Confirmed in | D: Expected in | E: Committed out | F: Likely out | G: Closing (conservative) | H: Closing (likely) |
|---|---|---|---|---|---|---|---|
| 2026-05-19 | 14200 | 8200 | 0 | 6400 | 1000 | =B2+C2-E2 | =B2+C2+D2-E2-F2 |
| 2026-05-26 | =G2 | 8000 | 2500 | 5500 | 1500 | =B3+C3-E3 | =B3+C3+D3-E3-F3 |
| ... fill down 12 rows ... | | | | | | | |

**Conservative** = only confirmed inflows
**Likely** = + expected inflows + likely outflows

Cell formula for runway: separately cell `I1` = `=MIN(IF(G2:G13<=0, ROW(G2:G13)-ROW(G2), 12))` (array formula — Ctrl+Shift+Enter on Excel; on Sheets just hit Enter)

**WIN AI reads:** weekly to generate Friday cashflow review
**You update:** confirmed inflows column when invoices clear

---

## Tab 7: `Metrics_Log`

KPI dump — anything that's a metric over time. Mirrors Supabase `kpi_log` table.

| A: Date | B: Business | C: Metric | D: Value | E: Source | F: Notes |
|---|---|---|---|---|---|
| 2026-05-21 | xalt | waitlist | 1847 | manual | |
| 2026-05-21 | xalt | ig_followers | 423 | manual | |
| 2026-05-21 | churns | mrr | 11000 | computed | Dr Lim added |
| 2026-05-21 | xalt | oem_status | amber | voice note | |

Business (dropdown): `churns` `xalt` `personal`
Metric (dropdown): `mrr` `waitlist` `ig_followers` `xhs_followers` `boxes_sold` `audit_calls_week` `dms_received_week` `posts_shipped_week` `oem_status` `runway_weeks` (add as needed)

**WIN AI writes:** every voice note KPI update logs here (via n8n Google Sheets node)
**WIN AI reads:** trend analysis for Monday review

---

## Sharing & access

1. Sheet must be shared with the service account email n8n's Google Sheets node uses.
   - In n8n: add a Google Sheets OAuth credential OR a Service Account credential
   - If service account: take the email shown (looks like `xxx@xxx.iam.gserviceaccount.com`) → share the sheet with it as `Editor`

2. Sheet ID — n8n needs this. From the URL:
   ```
   https://docs.google.com/spreadsheets/d/<THIS_PART_IS_THE_ID>/edit
   ```
   Save as `GSHEET_FINANCE_ID` in n8n env vars.

---

## Quick-fill formulas (paste into helper cells if you want)

```
# In a "Dashboard" tab (optional 8th tab):
Cell A1: "Cash now"          B1: =VLOOKUP(MAX(Cash!A:A), Cash!A:E, 5, FALSE)
Cell A2: "Burn 4wk avg"      B2: =AVERAGEIFS(Outflows!E:E, Outflows!A:A, ">="&TODAY()-28, Outflows!A:A, "<="&TODAY())  / 4
Cell A3: "Runway weeks"      B3: =B1/B2
Cell A4: "Churns MRR active" B4: ='MRR_Churns'!D[total cell]
Cell A5: "XALT capex spent"  B5: ='Capex_XALT'!D[total cell]
Cell A6: "XALT capex left"   B6: ='Capex_XALT'!E[total cell]
```

WIN AI's morning brief and Friday review read this Dashboard tab first — fewer hops.

---

## Maintenance discipline

| Frequency | What to do |
|---|---|
| Daily | Log Cash row + any new inflows/outflows |
| Weekly (Fri before WIN AI's 17:00 review) | Update Forecast_12wk confirmed columns |
| Monthly | Add new clients to MRR_Churns; review Capex_XALT remaining |
| Quarterly | Archive completed Forecast_12wk rows; reset tax reserve target |

If you fall behind by >7 days, WIN AI's Friday review will say so explicitly:
> "sheet last updated 9 days ago. some numbers in this review are stale. voice me 30sec of updates."
