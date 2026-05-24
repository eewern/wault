# notionwern Setup for GROGU

> **One-time setup. Do this before the builder starts.** Takes ~15 minutes.
>
> notionwern is GROGU's knowledge base (reads your bibles) and document output surface (writes reviews, decisions, tasks, journals back here). Everything GROGU produces appears in your notionwern browser.

---

## Step 1 — Start the API server

```bash
cd "/Users/eewern/Desktop/Notion design"
node workspace-api-server.mjs
```

Server runs at `http://127.0.0.1:3334` by default.

For production (when you move this to a server): set `WORKSPACE_API_HOST=0.0.0.0` and point your domain to it. That URL becomes `NOTIONWERN_BASE_URL` in n8n.

---

## Step 2 — Confirm your bible workspaces exist

Run this to see what workspaces you have:

```bash
curl http://127.0.0.1:3334/api/workspaces | jq '.workspaces[] | {id, name}'
```

You should see a `churns_ai_bible` workspace and an XALT bible workspace.

**If they don't exist yet**, create them now and paste your bible text in as pages. GROGU reads everything in those workspaces as strategy context. Every section = one page.

Note the exact workspace IDs — you'll need them for n8n env vars:
- `NOTIONWERN_CHURNS_WS_ID` = _______________
- `NOTIONWERN_XALT_WS_ID` = _______________

---

## Step 3 — Create the GROGU OPS workspace

This is where GROGU writes all its output documents. Run this curl once:

```bash
curl -X PUT http://127.0.0.1:3334/api/workspaces/grogu_ops \
  -H 'content-type: application/json' \
  -d '{
    "name": "GROGU OPS",
    "data": {
      "pages": {},
      "rootOrder": [],
      "childOrder": {},
      "currentPageId": null
    }
  }'
```

`NOTIONWERN_GROGU_WS_ID` = `grogu_ops`

---

## Step 4 — Create the parent pages inside GROGU OPS

GROGU organises its output into sections. Create the parent pages now (GROGU will create child pages under each one automatically):

```bash
# Weekly Reviews
curl -X POST http://127.0.0.1:3334/api/workspaces/grogu_ops/pages \
  -H 'content-type: application/json' \
  -d '{"title": "Weekly Reviews", "icon": "📊", "blocks": [{"type": "text", "text": "<p>Auto-generated every Monday 8am by GROGU.</p>"}]}'

# Daily Journal
curl -X POST http://127.0.0.1:3334/api/workspaces/grogu_ops/pages \
  -H 'content-type: application/json' \
  -d '{"title": "Daily Journal", "icon": "📓", "blocks": [{"type": "text", "text": "<p>Auto-generated every evening by GROGU from EOD check-in.</p>"}]}'

# Decision Log
curl -X POST http://127.0.0.1:3334/api/workspaces/grogu_ops/pages \
  -H 'content-type: application/json' \
  -d '{"title": "Decision Log", "icon": "⚡", "blocks": [{"type": "text", "text": "<p>Every decision you voice — with bible check result — logged here automatically.</p>"}]}'

# KPI Snapshots
curl -X POST http://127.0.0.1:3334/api/workspaces/grogu_ops/pages \
  -H 'content-type: application/json' \
  -d '{"title": "KPI Snapshots", "icon": "📈", "blocks": [{"type": "text", "text": "<p>Wednesday mid-week check + milestone events logged here.</p>"}]}'

# Ideas Vault
curl -X POST http://127.0.0.1:3334/api/workspaces/grogu_ops/pages \
  -H 'content-type: application/json' \
  -d '{"title": "Ideas Vault", "icon": "💡", "blocks": [{"type": "text", "text": "<p>Every idea from your voice notes. Monday triage scores each one: Keep / Park / Kill.</p>"}]}'
```

---

## Step 5 — Create the Task Board page

The Task Board is a single page GROGU updates **in-place** every time you add a todo via voice note. It shows your live open tasks as a checklist.

```bash
curl -X POST http://127.0.0.1:3334/api/workspaces/grogu_ops/pages \
  -H 'content-type: application/json' \
  -d '{
    "title": "Task Board",
    "icon": "✅",
    "blocks": [
      {
        "type": "callout",
        "icon": "🤖",
        "text": "Managed by GROGU. Updated automatically when you voice a task."
      },
      {
        "type": "heading",
        "level": 2,
        "text": "Open Tasks"
      },
      {
        "type": "checklist",
        "items": []
      }
    ]
  }'
```

Note the returned page `id` — save it as `NOTIONWERN_GROGU_TASK_BOARD_PAGE_ID` in n8n.

---

## Step 6 — Get all page IDs

Run this to get the IDs of all pages you just created:

```bash
curl http://127.0.0.1:3334/api/workspaces/grogu_ops/pages | jq '.pages[] | {id, title}'
```

Map these to your n8n env vars:

| n8n env var | notionwern page title | Page ID |
|---|---|---|
| `NOTIONWERN_GROGU_REVIEWS_PAGE_ID` | Weekly Reviews | ___________ |
| `NOTIONWERN_GROGU_JOURNAL_PAGE_ID` | Daily Journal | ___________ |
| `NOTIONWERN_GROGU_DECISIONS_PAGE_ID` | Decision Log | ___________ |
| `NOTIONWERN_GROGU_KPI_PAGE_ID` | KPI Snapshots | ___________ |
| `NOTIONWERN_GROGU_TASK_BOARD_PAGE_ID` | Task Board | ___________ |

---

## Step 7 — Set authentication token (production)

For your live server, start with a token:

```bash
WORKSPACE_API_TOKEN="your-secret-token" node workspace-api-server.mjs
```

Set in n8n:
- `NOTIONWERN_API_TOKEN` = `your-secret-token`
- `NOTIONWERN_BASE_URL` = `https://your-production-domain.com` (once deployed)

---

## Step 8 — Verify everything is working

```bash
# Check health
curl http://127.0.0.1:3334/health

# Check GROGU OPS workspace exists with pages
curl http://127.0.0.1:3334/api/workspaces/grogu_ops/pages | jq '.pages | length'
# Should return 6 (5 parent pages + task board)

# Check Churns Bible is readable
curl http://127.0.0.1:3334/api/workspaces/churns_ai_bible/pages | jq '.pages | length'
# Should return > 0
```

---

## Step 9 — Add all env vars to n8n

Go to n8n → Settings → Variables and add:

```
NOTIONWERN_BASE_URL          = http://127.0.0.1:3334  (change to prod URL later)
NOTIONWERN_API_TOKEN         = your-secret-token
NOTIONWERN_CHURNS_WS_ID      = [from Step 2]
NOTIONWERN_XALT_WS_ID        = [from Step 2]
NOTIONWERN_GROGU_WS_ID       = grogu_ops
NOTIONWERN_GROGU_TASK_BOARD_PAGE_ID  = [from Step 6]
NOTIONWERN_GROGU_JOURNAL_PAGE_ID     = [from Step 6]
NOTIONWERN_GROGU_DECISIONS_PAGE_ID   = [from Step 6]
NOTIONWERN_GROGU_REVIEWS_PAGE_ID     = [from Step 6]
NOTIONWERN_GROGU_KPI_PAGE_ID         = [from Step 6]
```

---

## What you'll see in notionwern after GROGU is live

Open notionwern in your browser → switch to **GROGU OPS** workspace:

```
GROGU OPS/
├── 📊 Weekly Reviews/
│   ├── Week of 2026-05-25  ← written every Monday 8am
│   └── Week of 2026-06-01
├── 📓 Daily Journal/
│   ├── 2026-05-24          ← written every evening from EOD
│   └── ...
├── ⚡ Decision Log/
│   ├── Decision: "Run property event" — CLEAR   ← logged every time you voice a decision
│   └── Decision: "Build generic chatbot" — CONFLICT
├── 📈 KPI Snapshots/
│   ├── Wed 2026-05-27 — Mid-week  ← written every Wednesday noon
│   └── ...
├── 💡 Ideas Vault/
│   ├── 💡 "Property audit reframe"   ← from voice notes
│   └── ...
└── ✅ Task Board          ← updated in-place every time you say "remind me to..."
```

No manual entry required. GROGU writes everything. You just read it.

---

## Important: bibles must be in notionwern before n8n builds start

GROGU reads your Churns Bible and XALT Bible from notionwern to ground every strategic answer, decision check, and recommendation. If the bibles aren't there, GROGU is operating blind.

**Before handing to a builder:** confirm the bible workspaces are populated. Run:
```bash
curl http://127.0.0.1:3334/api/workspaces/churns_ai_bible/pages | jq '.pages[].title'
```
You should see section titles like "§01 Vision", "§11 KPI Dashboard", "§13 No-Build List", etc.
