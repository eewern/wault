# Invoicing & Simple Accounting — XALT / Churns Tech

Two things live here:

1. **`invoice.html`** — your self-owned invoice generator (no subscription).
2. **Google Sheets accounting template** (below) — your simple books until you outgrow it.

---

## 1. Invoice generator (`invoice.html`)

Open `invoice.html` in any browser (double-click it). Works offline, nothing is uploaded anywhere — your data stays in the browser.

**How to use**
- **Switch company:** top-left toggle (XALT ↔ Churns Tech). Swaps logo, "From" details, bank details, accent colour, and the notes template.
- **Upload logo:** click the logo box → pick your PNG/JPG. Each company keeps its own logo. (Churns uses a text logo until you upload the real one.)
- **Ship-to / SST:** toggles in the toolbar. Ship-to is on by default for XALT (physical products), off for Churns. SST adds an editable-% tax line.
- **Line items:** "+ Add line item"; hover a row and click the "×" to remove it.
- **Download PDF:** click **⬇ Download PDF** → in the print dialog choose **"Save as PDF"** as the destination → Save.
- **Save / reuse an invoice:** **Save JSON** downloads the invoice as a file; **Load JSON** re-opens it later to duplicate or edit.
- Your work autosaves in the browser, so reopening the file restores your last invoice.

**Invoice numbering:** XALT uses `XLT-0001`, Churns uses `CHT-0001`. Bump the number yourself for each new invoice, and **record every invoice in the Sheet below** so numbers never clash and you can track who has paid.

> Malaysia note: once your revenue crosses the LHDN e-invoicing (MyInvois) threshold for your phase, invoices must be submitted to LHDN. This generator makes normal PDFs — good for now. When you get there, **Bukku** does MyInvois submission for you; that's the moment to switch, not before.

---

## 2. Google Sheets accounting template

Create one Google Sheet named **"XALT + Churns — Books 2026"** with **4 tabs**. Copy the columns exactly; the formulas do the rest. This keeps XALT and Churns in one place, separated by a **Company** column.

### Tab 1 — `Invoices` (invoice register)
One row per invoice you issue from `invoice.html`.

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Invoice No | Company | Date | Client | Amount (excl. SST) | SST | Total | Status | Paid Date |

- **G2 (Total):** `=E2+F2` — fill down.
- **Status:** use a dropdown → Data → Data validation → list: `Draft, Sent, Paid, Overdue`.
- Keep **Invoice No** matching exactly what you put in the generator.

### Tab 2 — `Ledger` (income & expenses)
Every money movement — sales received, and business costs.

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Date | Company | Type | Category | Description | Amount |

- **Type** dropdown: `Income, Expense`.
- **Category** examples — Income: `Product Sales, Service Fee`; Expense: `Stock, Packaging, Ads, Software, Fees, Salary, Other`.
- Enter **Amount** as a positive number; the Type column tells income from expense.

### Tab 3 — `Summary` (auto totals)
Put labels in column A and these formulas in column B. Adjust `2026` / dates as needed.

| Metric | Formula (paste in B) |
|---|---|
| XALT income | `=SUMIFS(Ledger!F:F, Ledger!B:B,"XALT", Ledger!C:C,"Income")` |
| XALT expenses | `=SUMIFS(Ledger!F:F, Ledger!B:B,"XALT", Ledger!C:C,"Expense")` |
| XALT profit | `=B2-B3` |
| Churns income | `=SUMIFS(Ledger!F:F, Ledger!B:B,"Churns", Ledger!C:C,"Income")` |
| Churns expenses | `=SUMIFS(Ledger!F:F, Ledger!B:B,"Churns", Ledger!C:C,"Expense")` |
| Churns profit | `=B5-B6` |
| SST collected (all) | `=SUM(Invoices!F:F)` |
| Outstanding (unpaid invoices) | `=SUMIFS(Invoices!G:G, Invoices!H:H,"<>Paid")` |
| Total invoiced | `=SUM(Invoices!G:G)` |

(Row numbers above assume the metric list starts at B2. If yours differ, fix the `B2-B3` style references.)

### Tab 4 — `Monthly` (optional, revenue by month)
Column A = month start dates (`1 Jan 2026`, `1 Feb 2026`, …). Then per company:

`=SUMIFS(Ledger!F:F, Ledger!B:B,"XALT", Ledger!C:C,"Income", Ledger!A:A,">="&A2, Ledger!A:A,"<"&EDATE(A2,1))`

Duplicate the column for Churns by changing `"XALT"` → `"Churns"`.

---

## Workflow, end to end
1. Make the invoice in `invoice.html` → **Download PDF** → send to client.
2. Add one row to the **`Invoices`** tab (No, Company, Date, Client, amounts, Status = `Sent`).
3. When paid: set **Status = `Paid`**, fill **Paid Date**, and add an **Income** row in **`Ledger`**.
4. Log business costs in **`Ledger`** as **Expense** rows as they happen.
5. Read **`Summary`** any time for profit per company, SST collected, and what's still owed.

## When to graduate to Bukku
Move off Sheets to **Bukku** when any of these hit: you're liable for MyInvois e-invoicing, you register for SST, an accountant/audit needs proper records, or logging by hand becomes a chore. Until then, this is enough — and cheaper.
