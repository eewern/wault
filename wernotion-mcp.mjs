#!/usr/bin/env node
/**
 * wernotion-mcp.mjs — MCP server for wernotion
 *
 * Exposes wernotion pages/blocks as Claude-readable tools via the MCP stdio transport.
 * Wraps the existing wernotion REST API (workspace-api-server.mjs) at port 3334.
 *
 * Add to Claude Code settings:
 *   "mcpServers": {
 *     "wernotion": {
 *       "command": "node",
 *       "args": ["/Users/eewern/Desktop/Claude project /Notion design/wernotion-mcp.mjs"]
 *     }
 *   }
 */

import http from "node:http";
import https from "node:https";
import { createInterface } from "node:readline";

const API_URL   = (process.env.WERNOTION_API_URL   || "https://wernotion.netlify.app").replace(/\/$/, "");
const API_TOKEN = process.env.WERNOTION_API_TOKEN   || "";
const VERSION   = "1.0.0";

// ─── tiny HTTP helper ────────────────────────────────────────────────────────
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const lib = url.protocol === "https:" ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(API_TOKEN ? { "Authorization": `Bearer ${API_TOKEN}` } : {}),
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── block → plain text ──────────────────────────────────────────────────────
function blockToText(block) {
  const plain = (h) => String(h || "").replace(/<[^>]*>/g, "").replace(/​/g, "").trim();
  switch (block.type) {
    case "heading":   return `${"#".repeat(block.level || 1)} ${plain(block.text)}`;
    case "text":      return plain(block.text);
    case "callout":   return `💡 ${plain(block.text)}`;
    case "divider":   return "---";
    case "bullets":   return (block.items||[]).map(i => `• ${plain(i.text)}`).join("\n");
    case "numbers":   return (block.items||[]).map((i,n) => `${n+1}. ${plain(i.text)}`).join("\n");
    case "checklist": return (block.items||[]).map(i => `- [${i.done?"x":" "}] ${plain(i.text)}`).join("\n");
    case "milestones":return (block.items||[]).map(i => `- [${i.status==="done"?"x":" "}] ${plain(i.name)} (${i.status})`).join("\n");
    case "table": {
      const rows = [(block.headers||[]).join("\t"), ...(block.rows||[]).map(r=>(r.cells||[]).join("\t"))];
      return rows.join("\n");
    }
    case "kpis":      return (block.items||[]).map(i=>`${plain(i.label)}: ${plain(i.value)}${i.unit||""}`).join(" | ");
    case "progress":  return `${plain(block.label)}: ${block.value}/${block.total}`;
    default:          return plain(block.text || "");
  }
}

function pageToMarkdown(page) {
  const title = String(page.title || "Untitled").replace(/<[^>]*>/g, "");
  const blocks = (page.blocks || []).map(blockToText).filter(Boolean).join("\n\n");
  return `# ${title}\n\n${blocks}`;
}

// ─── tool definitions ────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_workspaces",
    description: "List all available wernotion workspaces with their IDs, names, and page counts.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_pages",
    description: "List all pages in a workspace with their IDs, titles, and nesting. Pass workspace_id (default: the first/active workspace).",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string", description: "Workspace ID (omit to use the active workspace)" },
      },
      required: [],
    },
  },
  {
    name: "read_page",
    description: "Read the full content of a wernotion page (title + all blocks) as readable Markdown-like text.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string", description: "Workspace ID" },
        page_id:      { type: "string", description: "Page ID" },
      },
      required: ["page_id"],
    },
  },
  {
    name: "search_pages",
    description: "Search wernotion pages by title or text content. Returns matching page IDs, titles, and snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query:        { type: "string",  description: "Search query" },
        workspace_id: { type: "string",  description: "Workspace ID (omit to search all)" },
        max_results:  { type: "integer", description: "Maximum results to return (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_page",
    description: "Create a new page in wernotion with the given title and optional Markdown content.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string", description: "Workspace ID" },
        title:        { type: "string", description: "Page title" },
        markdown:     { type: "string", description: "Page content as Markdown (optional). Use # for headings, - for bullets, 1. for numbers, - [ ] / - [x] for checklists." },
        parent_id:    { type: "string", description: "Parent page ID (optional — omit for top-level)" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_page",
    description: "Update the title and/or content (blocks) of an existing wernotion page.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string", description: "Workspace ID" },
        page_id:      { type: "string", description: "Page ID" },
        title:        { type: "string", description: "New title (omit to keep existing)" },
        markdown:     { type: "string", description: "New full content as Markdown (replaces all blocks). Omit to keep existing blocks." },
      },
      required: ["page_id"],
    },
  },
  {
    name: "append_to_page",
    description: "Append Markdown content to the end of an existing wernotion page without replacing existing content.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string", description: "Workspace ID" },
        page_id:      { type: "string", description: "Page ID" },
        markdown:     { type: "string", description: "Markdown content to append" },
      },
      required: ["page_id", "markdown"],
    },
  },
];

// ─── Markdown → blocks (minimal parser matching the app's parseMarkdownishBlocks) ─
function nid() { return `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

function parseMarkdownToBlocks(md) {
  const lines = String(md || "").split("\n");
  const blocks = [];
  let i = 0;

  const flush = (type, items) => {
    if (!items.length) return;
    blocks.push({ id: nid(), type, items });
  };

  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) { blocks.push({ id: nid(), type: "heading", level: h[1].length, text: h[2].trim() }); i++; continue; }

    const hr = line.match(/^---+$|^\*\*\*+$/);
    if (hr) { blocks.push({ id: nid(), type: "divider" }); i++; continue; }

    // Collect checklist run
    if (line.match(/^- \[[ x]\] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^- \[[ x]\] /)) {
        const m = lines[i].match(/^- \[([ x])\] (.*)/);
        items.push({ id: nid(), text: m[2].trim(), done: m[1] === "x", dueDate: "" });
        i++;
      }
      flush("checklist", items); continue;
    }

    // Collect bullet run
    if (line.match(/^[-*•]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s+/)) {
        items.push({ id: nid(), text: lines[i].replace(/^[-*•]\s+/, "").trim() });
        i++;
      }
      flush("bullets", items); continue;
    }

    // Collect numbered run
    if (line.match(/^\d+[.)]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+[.)]\s+/)) {
        items.push({ id: nid(), text: lines[i].replace(/^\d+[.)]\s+/, "").trim() });
        i++;
      }
      flush("numbers", items); continue;
    }

    if (line.trim()) { blocks.push({ id: nid(), type: "text", text: line.trim() }); }
    i++;
  }
  return blocks;
}

// ─── resolve workspace ID ────────────────────────────────────────────────────
async function resolveWorkspaceId(given) {
  if (given) return given;
  // Try the /api/workspace/active endpoint first
  try {
    const r = await apiRequest("GET", "/api/workspace/active");
    if (r.status === 200 && r.body?.workspace?.id) return r.body.workspace.id;
  } catch {}
  // Fall back: first in list
  const r = await apiRequest("GET", "/api/workspaces");
  const list = r.body?.workspaces || [];
  if (!list.length) throw new Error("No workspaces found. Is the wernotion API server running at " + API_URL + "?");
  return list[0].id;
}

// ─── tool handlers ───────────────────────────────────────────────────────────
async function handleTool(name, args) {
  switch (name) {

    case "list_workspaces": {
      const r = await apiRequest("GET", "/api/workspaces");
      if (r.status !== 200) throw new Error(`API error ${r.status}: ${JSON.stringify(r.body)}`);
      const workspaces = r.body.workspaces || [];
      const lines = workspaces.map(w =>
        `• ${w.name} (id: ${w.id}) — ${w.pageCount} pages, updated: ${w.updatedAt || "never"}`
      );
      return lines.length
        ? `Found ${lines.length} workspace(s):\n\n${lines.join("\n")}`
        : "No workspaces found. Ensure the API server is running and synced with the browser.";
    }

    case "list_pages": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      const r = await apiRequest("GET", `/api/workspaces/${wsId}/pages`);
      if (r.status !== 200) throw new Error(`API error ${r.status}`);
      const pages = r.body.pages || [];
      const lines = pages.map(p => {
        const indent = p.parentId ? "  " : "";
        return `${indent}• [${p.id}] ${String(p.title || "Untitled").replace(/<[^>]*>/g,"")}`;
      });
      return lines.length
        ? `${pages.length} pages in workspace "${wsId}":\n\n${lines.join("\n")}`
        : `No pages found in workspace "${wsId}".`;
    }

    case "read_page": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      const r = await apiRequest("GET", `/api/workspaces/${wsId}/pages/${args.page_id}`);
      if (r.status === 404) throw new Error(`Page "${args.page_id}" not found.`);
      if (r.status !== 200) throw new Error(`API error ${r.status}`);
      const page = r.body.page || r.body;
      return pageToMarkdown(page);
    }

    case "search_pages": {
      const maxResults = Number(args.max_results) || 10;
      const query = String(args.query || "").toLowerCase();
      if (!query) throw new Error("Query must not be empty.");

      // Get all workspaces to search
      const wsListR = await apiRequest("GET", "/api/workspaces");
      const workspaces = (wsListR.body.workspaces || [])
        .filter(w => !args.workspace_id || w.id === args.workspace_id);

      const results = [];
      for (const ws of workspaces) {
        const r = await apiRequest("GET", `/api/workspaces/${ws.id}/pages`);
        for (const page of (r.body.pages || [])) {
          const titleText = String(page.title || "").replace(/<[^>]*>/g,"").toLowerCase();
          const blockText = (page.blocks || []).map(blockToText).join(" ").toLowerCase();
          if (titleText.includes(query) || blockText.includes(query)) {
            const snippet = blockText.replace(/\s+/g," ").trim().slice(0, 160);
            results.push({ wsId: ws.id, wsName: ws.name, id: page.id, title: String(page.title||"Untitled").replace(/<[^>]*>/g,""), snippet });
            if (results.length >= maxResults) break;
          }
        }
        if (results.length >= maxResults) break;
      }

      if (!results.length) return `No pages found matching "${args.query}".`;
      return results.map(r =>
        `[${r.wsName}] Page "${r.title}" (id: ${r.id})\n  ${r.snippet}…`
      ).join("\n\n");
    }

    case "create_page": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      const blocks = args.markdown ? parseMarkdownToBlocks(args.markdown) : [{ id: nid(), type: "text", text: "" }];
      const body = {
        title: args.title || "Untitled",
        blocks,
        ...(args.parent_id ? { parentId: args.parent_id } : {}),
      };
      const r = await apiRequest("POST", `/api/workspaces/${wsId}/pages`, body);
      if (r.status !== 201 && r.status !== 200) throw new Error(`API error ${r.status}: ${JSON.stringify(r.body)}`);
      const page = r.body.page || r.body;
      return `✅ Created page "${args.title}" with id "${page.id}" in workspace "${wsId}".`;
    }

    case "update_page": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      const patch = {};
      if (args.title    !== undefined) patch.title  = args.title;
      if (args.markdown !== undefined) patch.blocks = parseMarkdownToBlocks(args.markdown);
      if (!Object.keys(patch).length) return "Nothing to update — provide title and/or markdown.";
      const r = await apiRequest("PATCH", `/api/workspaces/${wsId}/pages/${args.page_id}`, patch);
      if (r.status === 404) throw new Error(`Page "${args.page_id}" not found.`);
      if (r.status !== 200) throw new Error(`API error ${r.status}: ${JSON.stringify(r.body)}`);
      return `✅ Updated page "${args.page_id}".`;
    }

    case "append_to_page": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      // Fetch existing blocks
      const existing = await apiRequest("GET", `/api/workspaces/${wsId}/pages/${args.page_id}`);
      if (existing.status === 404) throw new Error(`Page "${args.page_id}" not found.`);
      const page = existing.body.page || existing.body;
      const newBlocks = parseMarkdownToBlocks(args.markdown);
      const merged = [...(page.blocks || []), ...newBlocks];
      const r = await apiRequest("PATCH", `/api/workspaces/${wsId}/pages/${args.page_id}`, { blocks: merged });
      if (r.status !== 200) throw new Error(`API error ${r.status}: ${JSON.stringify(r.body)}`);
      return `✅ Appended ${newBlocks.length} block(s) to page "${args.page_id}".`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP stdio transport ─────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, terminal: false });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function err(code, message, id = null) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

rl.on("line", async (line) => {
  let msg;
  try { msg = JSON.parse(line); }
  catch { return; }

  const { id, method, params } = msg;

  try {
    if (method === "initialize") {
      send({
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "wernotion", version: VERSION },
        },
      });
      return;
    }

    if (method === "notifications/initialized") return; // no response needed

    if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      return;
    }

    if (method === "tools/call") {
      const { name, arguments: toolArgs = {} } = params || {};
      try {
        const text = await handleTool(name, toolArgs);
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
      } catch (e) {
        send({
          jsonrpc: "2.0", id,
          result: { content: [{ type: "text", text: `❌ Error: ${e.message}` }], isError: true },
        });
      }
      return;
    }

    err(-32601, `Method not found: ${method}`, id);
  } catch (e) {
    err(-32603, `Internal error: ${e.message}`, id);
  }
});

rl.on("close", () => process.exit(0));

// Verify API connectivity on start (non-fatal)
apiRequest("GET", "/health").then(r => {
  if (r.status !== 200) {
    process.stderr.write(`[wernotion-mcp] Warning: API at ${API_URL} returned ${r.status}. Is workspace-api-server.mjs running?\n`);
  } else {
    process.stderr.write(`[wernotion-mcp] Connected to wernotion API at ${API_URL}\n`);
  }
}).catch(() => {
  process.stderr.write(`[wernotion-mcp] Warning: cannot reach ${API_URL}. Start workspace-api-server.mjs first.\n`);
});
