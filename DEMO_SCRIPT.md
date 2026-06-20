# WAULT — Demo Script

A ready-to-run walkthrough for showing off WAULT. Suggested order flows from
"capture work" → "organize it" → "collaborate / automate". Each section has a
one-line **say** (what to tell the audience) and **do** (the clicks).

> Setup: open the app and sign in. To pre-fill the Focus dashboard with realistic
> data, load **`<your-url>/?demo=1`** once while signed in — it seeds tasks across
> every bucket and pins a few to Today's Focus, then cleans the URL.

---

## 1. Focus — "your day at a glance"
**Say:** "WAULT opens on Focus — everything due, auto-organized by date. No manual sorting."
**Do:**
- Point out the hero: **"N due today · M overdue"** and the streak ring.
- **Today's Focus** auto-fills your top 3 (pin your own with ☆, unpin to swap).
- Scroll the buckets: **Overdue → Due Today → Upcoming → No date → On Hold → Done**.
- Add a task inline: type `ship the deck !high tomorrow` in the quick-add → it lands in the right bucket from the natural-language date/priority.
- Tick a task done → watch it move to **Done** and update the count.

## 2. Workspaces — "separate worlds, one app"
**Say:** "Switch between workspaces — clients, teams, personal — each with its own pages."
**Do:**
- Open the **workspace switcher** (top-left). Switch workspaces; the sidebar + Focus update.
- Mention the workspace cards on Focus ("jump back into your work").

## 3. The editor — "blocks for everything"
**Say:** "Every page is made of blocks. Type `/` to insert anything."
**Do:**
- On a page, type `/` to open the slash menu. Insert a **heading**, a **to-do list**, a **callout**.
- Show **nested lists**: create a bullet, press **Tab** to indent, **Shift+Tab** to outdent.
- Drag a block by its **left grip (⠿)** to reorder — works on **desktop and mobile (touch)**.
- Insert an **image**: `/image` → upload a file → add a caption.

## 4. Copy / paste / delete fidelity — "what you highlight is what you get" ⭐
**Say:** "Selection-accurate editing — copy or delete exactly what's highlighted, formatting and nesting preserved."
**Do:**
- Highlight across **two blocks** (e.g. a heading + a nested list) → **Copy** → paste into a new line: types and nesting come back intact.
- Highlight **several list rows including a nested child** → **Backspace**: only the highlighted rows go; partial boundary rows keep their leftover text.
- (For the technically curious: open `<url>/?selftest=clipboard` and show the console logging `✅ clipboard self-test passed` — a built-in guard that runs on every local load.)

## 5. Tables — "structured data, fully editable" ⭐ (new)
**Say:** "Rich tables you can restructure on the fly."
**Do:**
- `/table` to insert. Type into cells; **drag a column edge** to resize.
- **Insert a row between rows**: hover a row → click the **`+`** in the row's action area → a new row drops in right below (not just at the end).
- **Reorder rows**: hover a row → grab the **⠿ grip** (right side) → drag up/down; a blue line shows where it'll land.
- **Reorder columns**: hover a header → grab the **⠿ grip** → drag left/right.
- **Checkbox columns**: click the **☑** in a header to turn a column into checkboxes (great for status/done tracking).
- **`+ row`** appends at the end; the trailing **`+`** header button adds a column.

## 6. More block types — "not just docs"
**Say:** "Kanban boards, calendars, KPIs — all inline."
**Do:**
- Insert a **kanban / milestones** block → drag cards across columns; toggle List/Board view.
- Insert a **calendar** block → add an event.
- Insert a **KPI** block → show metric cards.

## 7. Templates & export
**Say:** "Reuse layouts and share polished output."
**Do:**
- **Templates** button → start a page from a template.
- **Save as template** → turn the current page into a reusable one.
- **↓ PDF** → export the page.

## 8. Mobile — "the whole thing, on a phone"
**Say:** "Fully responsive — same workspace in your pocket."
**Do:** (open on a phone or resize the browser to ~375px)
- **Hamburger (top-left)** opens the sidebar drawer; tap a page to navigate, tap the overlay to close.
- Editor: **tap between letters** to place the cursor exactly; **drag blocks** by the gutter grip.
- Focus, tables, and modals all reflow to one column.

## 9. Team access via Claude (MCP) — "your workspace, automated"
**Say:** "WAULT exposes an MCP server, so your team's Claude can read and write pages directly — like Notion's MCP."
**Do:**
- Show the team Claude config (SSE endpoint + bearer token) — see `COMPANY_MCP_SETUP.md`.
- In Claude, run a tool like `list_workspaces` / `read_page` / `create_page` and show it reflected live in WAULT.

---

## Quick "wow" path (3 minutes)
1. Land on **Focus** (pre-seeded via `?demo=1`) — due-today count + Today's Focus.
2. Open a page → **drag a block**, then **copy a nested list across blocks and paste** (fidelity).
3. Insert a **table** → **insert a row between**, **drag a row**, **drag a column**, flip a column to **checkboxes**.
4. Resize to mobile → open the **drawer**, drag a block, tap-to-place caret.
5. Trigger an **MCP tool from Claude** and show it appear in WAULT.

## Reset between demos
- Re-seed Focus: clear the seed flag in the console — `localStorage.removeItem('wault_focus_demo_v1')` — then reload with `?demo=1`.
