# GROGU Knowledge Base Reader — n8n Implementation

> GROGU reads both bibles **live** from notionwern every call. No cache. No snapshots.
> When you update a page in notionwern, the next GROGU response reflects it immediately.
>
> Total size: ~6,100 tokens for core strategy. Affordable to inject into every strategic call.

---

## What gets pulled per query type

| Query type | Churns pages pulled | XALT pages pulled | When used |
|---|---|---|---|
| `strategy` | Identity, Business Model, Journey OS, Verticals, Agent Architecture, ChurnsOS, Delivery, Milestones, KPIs, Locked Decisions, XALT Connection | Vision, Customer Profile, Product, Finance, GTM, Marketing, KPIs, Milestones | W2 (text chat), W6 (Monday review), W11 (next best action) |
| `decision` | Locked Decisions, Milestones | Vision/DNA, Milestones | W10 (bible contradiction check) |
| `kpi` | KPIs & Hiring, Milestones | KPIs Scorecard, Milestones | W3 (morning brief), W4 (EOD), W9 (mid-week check) |
| `content` | Content Funnel, Content Intelligence | Marketing & Content Strategy | W7 (content generator) |
| `full` | ALL pages | ALL pages | W6 Monday review (Sonnet, once/week) |

---

## n8n Implementation: Code Node (reusable)

Add this as a **Code node** anywhere you need KB context. Change `QUERY_TYPE` at the top.

```javascript
// ============================================================
// GROGU KB READER — paste into n8n Code node
// Set QUERY_TYPE to: 'strategy' | 'decision' | 'kpi' | 'content' | 'full'
// ============================================================
const QUERY_TYPE = 'strategy'; // ← change per workflow
const BASE_URL = $env.NOTIONWERN_BASE_URL;
const TOKEN = $env.NOTIONWERN_API_TOKEN;

const PAGES = {
  churns: {
    ws: $env.NOTIONWERN_CHURNS_WS_ID,
    strategy:  ['churns_identity','churns_business_model','churns_journey_os',
                'churns_verticals','churns_agent_architecture','churns_churnsos',
                'churns_delivery','churns_milestones','churns_kpis_hiring',
                'churns_locked_decisions','churns_xalt_connection'],
    decision:  ['churns_locked_decisions','churns_milestones'],
    kpi:       ['churns_kpis_hiring','churns_milestones'],
    content:   ['churns_content_funnel','churns_content_intelligence','churns_60_day_content'],
    full:      null  // null = fetch all pages dynamically
  },
  xalt: {
    ws: $env.NOTIONWERN_XALT_WS_ID,
    strategy:  ['xalt_identity','xalt_market','xalt_product','xalt_finance',
                'xalt_distribution','xalt_marketing','xalt_kpis','xalt_milestones'],
    decision:  ['xalt_identity','xalt_milestones'],
    kpi:       ['xalt_kpis','xalt_milestones'],
    content:   ['xalt_marketing','xalt_week_1_script'],
    full:      null
  }
};

const headers = { 'x-workspace-api-token': TOKEN };

// Extract clean text from a page's blocks
function extractText(page) {
  const parts = [`# ${page.title}`];
  for (const b of (page.blocks || [])) {
    const t = b.type;
    if (t === 'heading') {
      const clean = (b.text || '').replace(/<[^>]+>/g, ' ').trim();
      const prefix = b.level === 1 ? '##' : '###';
      if (clean) parts.push(`${prefix} ${clean}`);
    } else if (t === 'text' || t === 'callout') {
      const clean = (b.text || '').replace(/<[^>]+>/g, ' ').trim();
      if (clean) parts.push(clean);
    } else if (t === 'bullets' || t === 'numbers' || t === 'checklist') {
      for (const item of (b.items || [])) {
        const done = t === 'checklist' && item.done ? '☑' : '•';
        const indent = '  '.repeat(item.level || 0);
        parts.push(`${indent}${done} ${item.text || ''}`);
      }
    } else if (t === 'table') {
      if (b.headers?.length) {
        parts.push(b.headers.join(' | '));
        parts.push(b.headers.map(() => '---').join(' | '));
      }
      for (const row of (b.rows || [])) {
        parts.push((row.cells || []).join(' | '));
      }
    }
  }
  return parts.join('\n');
}

// Fetch a single page
async function fetchPage(wsId, pageId) {
  const res = await $http.request({
    method: 'GET',
    url: `${BASE_URL}/api/workspaces/${wsId}/pages/${pageId}`,
    headers
  });
  return res.body?.page || null;
}

// Fetch all pages in a workspace
async function fetchAllPages(wsId) {
  const res = await $http.request({
    method: 'GET',
    url: `${BASE_URL}/api/workspaces/${wsId}/pages`,
    headers
  });
  return (res.body?.pages || []).filter(p => p.blocks?.length > 0);
}

// Build the full KB text
const sections = [];
let totalChars = 0;

for (const [biz, cfg] of Object.entries(PAGES)) {
  const label = biz === 'churns' ? 'CHURNS AI BIBLE' : 'XALT STRATEGY BIBLE';
  sections.push(`\n${'='.repeat(60)}\n${label} — last updated: read from notionwern live\n${'='.repeat(60)}`);

  let pages = [];
  const pageIds = cfg[QUERY_TYPE];

  if (pageIds === null) {
    // full mode — fetch all pages
    pages = await fetchAllPages(cfg.ws);
  } else {
    // selective mode — fetch specific pages
    for (const pid of pageIds) {
      const page = await fetchPage(cfg.ws, pid);
      if (page) pages.push(page);
    }
  }

  for (const page of pages) {
    const text = extractText(page);
    sections.push(text);
    totalChars += text.length;
  }
}

const kb_text = sections.join('\n\n');

return [{
  json: {
    kb_text,
    kb_chars: totalChars,
    kb_tokens_est: Math.round(totalChars / 4),
    query_type: QUERY_TYPE,
    built_at: new Date().toISOString()
  }
}];
```

---

## How to use in each workflow

### In W2 (Text Chat) and W11 (Next Best Action)
```
[Code Node: KB Reader (query_type='strategy')]
    ↓
[Code Node: Build context block]
    ↓ injects kb_text into system prompt
[Anthropic Node: Claude]
```

System prompt addition:
```
KNOWLEDGE BASE (live from notionwern — {{kb_built_at}}):
{{kb_text}}
```

### In W10 (Decision Bible Check)
```
[Code Node: KB Reader (query_type='decision')]
    ↓
[Anthropic Node: Claude — check decision against kb_text]
```

### In W3 (Morning Brief) and W9 (Mid-Week KPI Check)
```
[Code Node: KB Reader (query_type='kpi')]
    ↓  (~1,200 tokens — just milestone + KPI pages)
[Anthropic Node: Claude — morning brief]
```

### In W6 (Monday Bible Review)
```
[Code Node: KB Reader (query_type='full')]
    ↓  (~15,000 tokens — entire bibles, Sonnet model)
[Anthropic Node: Claude Sonnet — weekly review]
```

### In W7 (Content Generator)
```
[Code Node: KB Reader (query_type='content')]
    ↓  (~5,000 tokens — content pages)
[Anthropic Node: Claude — generate post]
```

---

## Token cost breakdown (Haiku pricing $0.25/M input)

| Query type | ~tokens | Cost per call | Daily at 5 calls |
|---|---|---|---|
| `kpi` | ~1,200 | $0.0003 | $0.0015 |
| `decision` | ~1,500 | $0.0004 | $0.002 |
| `strategy` | ~6,100 | $0.0015 | $0.0075 |
| `content` | ~5,000 | $0.00125 | $0.006 |
| `full` (Sonnet) | ~15,000 | $0.045 | once/week |

**Knowledge base reads add less than $0.10/month to the bill** even at high usage.

---

## What this means for you

When you update any page in notionwern — rewrite a milestone, add a locked decision, update KPI thresholds, change strategy — GROGU reads the new version on the very next conversation. No redeployment. No cache to clear. No telling the builder "update the prompt."

Your bibles are the source of truth. GROGU treats them as live documents.

---

## Important: keep these pages clean

GROGU reads the raw text of your pages. A few rules to make the KB useful:

| Do | Don't |
|---|---|
| Use headings to structure sections | Leave big empty blocks |
| Keep milestones updated with current numbers | Leave old/completed milestones without marking them done |
| Use callout blocks for critical rules (they get extracted) | Put important info only in images (images are skipped) |
| Use tables for decisions/locked rules | Paste huge walls of unsorted text |
| Mark done checklist items as done | Leave resolved items as open |

The cleaner your pages, the smarter GROGU's responses.
