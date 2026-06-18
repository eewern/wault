#!/usr/bin/env node
/**
 * wault-mcp-http.mjs — Cloud-hosted HTTP/SSE MCP server for WAULT
 *
 * Implements the MCP SSE transport so any teammate can add a single URL
 * to their Claude Code settings and get full WAULT read/write access.
 *
 * ── Deploy to Railway ──────────────────────────────────────────────────────
 *   railway up  (from the WAULT v2 directory)
 *
 * ── Env vars (set in Railway dashboard) ───────────────────────────────────
 *   PORT             auto-set by Railway
 *   MCP_TOKEN        shared bearer token — give this string to teammates
 *   WAULT_API_URL    URL of the deployed WAULT API server
 *                    e.g. https://wault-api.up.railway.app
 *   WAULT_API_TOKEN  token for the WAULT API (WORKSPACE_API_TOKEN value)
 *
 * ── Teammate setup (Claude Code settings.json) ────────────────────────────
 *   "mcpServers": {
 *     "wault": {
 *       "type": "sse",
 *       "url": "https://YOUR-DEPLOYMENT.railway.app/sse",
 *       "headers": { "Authorization": "Bearer YOUR_MCP_TOKEN" }
 *     }
 *   }
 */

import http  from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";

const PORT      = parseInt(process.env.PORT      || "3335");
const MCP_TOKEN = (process.env.MCP_TOKEN         || "").trim();
const API_URL   = (process.env.WAULT_API_URL     || "http://127.0.0.1:3334").replace(/\/$/, "");
const API_TOKEN = (process.env.WAULT_API_TOKEN   || process.env.WERNOTION_API_TOKEN || "").trim();
const VERSION   = "2.0.0";

// ── Active SSE sessions ───────────────────────────────────────────────────────
// Map<sessionId, ServerResponse>
const sessions = new Map();

// ── Auth ──────────────────────────────────────────────────────────────────────
function authorized(req) {
  if (!MCP_TOKEN) return true; // no token configured = open (dev only)
  const h = req.headers["authorization"] || "";
  return h === `Bearer ${MCP_TOKEN}`;
}

// ── WAULT API helper ─────────────────────────────────────────────────────────
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(API_URL + path);
    const lib  = url.protocol === "https:" ? https : http;
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
      res.on("data", c => chunks.push(c));
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

// ── Block → readable text ────────────────────────────────────────────────────
function blockToText(block) {
  const plain = h => String(h || "").replace(/<[^>]*>/g, "").replace(/​/g, "").trim();
  switch (block.type) {
    case "heading":    return `${"#".repeat(block.level || 1)} ${plain(block.text)}`;
    case "text":       return plain(block.text);
    case "callout":    return `💡 ${plain(block.text)}`;
    case "divider":    return "---";
    case "bullets":    return (block.items || []).map(i => `• ${plain(i.text)}`).join("\n");
    case "numbers":    return (block.items || []).map((i, n) => `${n + 1}. ${plain(i.text)}`).join("\n");
    case "checklist":  return (block.items || []).map(i => `- [${i.done ? "x" : " "}] ${plain(i.text)}`).join("\n");
    case "milestones": return (block.items || []).map(i => `- [${i.status === "done" ? "x" : " "}] ${plain(i.name)} (${i.status})`).join("\n");
    case "table": {
      const rows = [(block.headers || []).join("\t"), ...(block.rows || []).map(r => (r.cells || []).join("\t"))];
      return rows.join("\n");
    }
    case "kpis":    return (block.items || []).map(i => `${plain(i.label)}: ${plain(i.value)}${i.unit || ""}`).join(" | ");
    case "progress":return `${plain(block.label)}: ${block.value}/${block.total}`;
    default:        return plain(block.text || "");
  }
}

function pageToMarkdown(page) {
  const title  = String(page.title || "Untitled").replace(/<[^>]*>/g, "");
  const blocks = (page.blocks || []).map(blockToText).filter(Boolean).join("\n\n");
  return `# ${title}\n\n${blocks}`;
}

// ── Markdown → blocks ────────────────────────────────────────────────────────
function nid() { return `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function parseMarkdownToBlocks(md) {
  const lines  = String(md || "").split("\n");
  const blocks = [];
  let i = 0;
  const flush = (type, items) => { if (items.length) blocks.push({ id: nid(), type, items }); };

  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h)                        { blocks.push({ id: nid(), type: "heading", level: h[1].length, text: h[2].trim() }); i++; continue; }
    if (line.match(/^---+$/))     { blocks.push({ id: nid(), type: "divider" }); i++; continue; }
    if (line.match(/^- \[[ x]\] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^- \[[ x]\] /)) {
        const m = lines[i].match(/^- \[([ x])\] (.*)/);
        items.push({ id: nid(), text: m[2].trim(), done: m[1] === "x", dueDate: "" });
        i++;
      }
      flush("checklist", items); continue;
    }
    if (line.match(/^[-*•]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s+/))
        items.push({ id: nid(), text: lines[i++].replace(/^[-*•]\s+/, "").trim() });
      flush("bullets", items); continue;
    }
    if (line.match(/^\d+[.)]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+[.)]\s+/))
        items.push({ id: nid(), text: lines[i++].replace(/^\d+[.)]\s+/, "").trim() });
      flush("numbers", items); continue;
    }
    if (line.trim()) blocks.push({ id: nid(), type: "text", text: line.trim() });
    i++;
  }
  return blocks;
}

// ── Workspace ID resolver ────────────────────────────────────────────────────
async function resolveWorkspaceId(given) {
  if (given) return given;
  try {
    const r = await apiRequest("GET", "/api/workspace/active");
    if (r.status === 200 && r.body?.workspace?.id) return r.body.workspace.id;
  } catch {}
  const r    = await apiRequest("GET", "/api/workspaces");
  const list = r.body?.workspaces || [];
  if (!list.length) throw new Error("No workspaces found. Is WAULT_API_URL reachable?");
  return list[0].id;
}

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_workspaces",
    description: "List all WAULT workspaces with their IDs, names, and page counts.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_pages",
    description: "List all pages in a workspace with IDs, titles, and nesting. Omit workspace_id to use the active workspace.",
    inputSchema: { type: "object", properties: { workspace_id: { type: "string" } }, required: [] },
  },
  {
    name: "read_page",
    description: "Read the full content of a WAULT page as Markdown.",
    inputSchema: { type: "object", properties: { workspace_id: { type: "string" }, page_id: { type: "string" } }, required: ["page_id"] },
  },
  {
    name: "search_pages",
    description: "Search WAULT pages by title or content. Returns matching IDs, titles, and snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query:        { type: "string"  },
        workspace_id: { type: "string"  },
        max_results:  { type: "integer" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_page",
    description: "Create a new WAULT page with a title and optional Markdown content.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        title:        { type: "string" },
        markdown:     { type: "string" },
        parent_id:    { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_page",
    description: "Update the title and/or content of an existing WAULT page.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        page_id:      { type: "string" },
        title:        { type: "string" },
        markdown:     { type: "string" },
      },
      required: ["page_id"],
    },
  },
  {
    name: "append_to_page",
    description: "Append Markdown content to the end of a WAULT page.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        page_id:      { type: "string" },
        markdown:     { type: "string" },
      },
      required: ["page_id", "markdown"],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────
async function handleTool(name, args) {
  switch (name) {
    case "list_workspaces": {
      const r = await apiRequest("GET", "/api/workspaces");
      if (r.status !== 200) throw new Error(`API error ${r.status}`);
      const ws = r.body.workspaces || [];
      return ws.length
        ? `Found ${ws.length} workspace(s):\n\n` + ws.map(w => `• ${w.name} (id: ${w.id}) — ${w.pageCount} pages`).join("\n")
        : "No workspaces found.";
    }
    case "list_pages": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      const r    = await apiRequest("GET", `/api/workspaces/${wsId}/pages`);
      if (r.status !== 200) throw new Error(`API error ${r.status}`);
      const pages = r.body.pages || [];
      return pages.length
        ? `${pages.length} pages in workspace "${wsId}":\n\n` + pages.map(p => `${p.parentId ? "  " : ""}• [${p.id}] ${String(p.title || "Untitled").replace(/<[^>]*>/g, "")}`).join("\n")
        : `No pages in workspace "${wsId}".`;
    }
    case "read_page": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      const r    = await apiRequest("GET", `/api/workspaces/${wsId}/pages/${args.page_id}`);
      if (r.status === 404) throw new Error(`Page "${args.page_id}" not found.`);
      if (r.status !== 200) throw new Error(`API error ${r.status}`);
      return pageToMarkdown(r.body.page || r.body);
    }
    case "search_pages": {
      const max   = Number(args.max_results) || 10;
      const query = String(args.query || "").toLowerCase();
      if (!query) throw new Error("Query must not be empty.");
      const wsListR  = await apiRequest("GET", "/api/workspaces");
      const wsList   = (wsListR.body.workspaces || []).filter(w => !args.workspace_id || w.id === args.workspace_id);
      const results  = [];
      for (const ws of wsList) {
        const r = await apiRequest("GET", `/api/workspaces/${ws.id}/pages`);
        for (const page of (r.body.pages || [])) {
          const tt = String(page.title || "").replace(/<[^>]*>/g, "").toLowerCase();
          const bt = (page.blocks || []).map(blockToText).join(" ").toLowerCase();
          if (tt.includes(query) || bt.includes(query)) {
            results.push({ wsName: ws.name, id: page.id, title: String(page.title || "Untitled").replace(/<[^>]*>/g, ""), snippet: bt.replace(/\s+/g, " ").trim().slice(0, 160) });
            if (results.length >= max) break;
          }
        }
        if (results.length >= max) break;
      }
      return results.length
        ? results.map(r => `[${r.wsName}] "${r.title}" (id: ${r.id})\n  ${r.snippet}…`).join("\n\n")
        : `No pages found matching "${args.query}".`;
    }
    case "create_page": {
      const wsId   = await resolveWorkspaceId(args.workspace_id);
      const blocks = args.markdown ? parseMarkdownToBlocks(args.markdown) : [{ id: nid(), type: "text", text: "" }];
      const r      = await apiRequest("POST", `/api/workspaces/${wsId}/pages`, { title: args.title || "Untitled", blocks, ...(args.parent_id ? { parentId: args.parent_id } : {}) });
      if (r.status !== 201 && r.status !== 200) throw new Error(`API error ${r.status}`);
      const page = r.body.page || r.body;
      return `✅ Created page "${args.title}" (id: ${page.id}) in workspace "${wsId}".`;
    }
    case "update_page": {
      const wsId = await resolveWorkspaceId(args.workspace_id);
      const patch = {};
      if (args.title    !== undefined) patch.title  = args.title;
      if (args.markdown !== undefined) patch.blocks = parseMarkdownToBlocks(args.markdown);
      if (!Object.keys(patch).length) return "Nothing to update — provide title and/or markdown.";
      const r = await apiRequest("PATCH", `/api/workspaces/${wsId}/pages/${args.page_id}`, patch);
      if (r.status === 404) throw new Error(`Page "${args.page_id}" not found.`);
      if (r.status !== 200) throw new Error(`API error ${r.status}`);
      return `✅ Updated page "${args.page_id}".`;
    }
    case "append_to_page": {
      const wsId   = await resolveWorkspaceId(args.workspace_id);
      const existing = await apiRequest("GET", `/api/workspaces/${wsId}/pages/${args.page_id}`);
      if (existing.status === 404) throw new Error(`Page "${args.page_id}" not found.`);
      const page   = existing.body.page || existing.body;
      const merged = [...(page.blocks || []), ...parseMarkdownToBlocks(args.markdown)];
      const r      = await apiRequest("PATCH", `/api/workspaces/${wsId}/pages/${args.page_id}`, { blocks: merged });
      if (r.status !== 200) throw new Error(`API error ${r.status}`);
      return `✅ Appended content to page "${args.page_id}".`;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP message processor ─────────────────────────────────────────────────────
async function processMessage(msg) {
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "wault", version: VERSION },
        },
      };
    }
    if (method === "notifications/initialized") return null;
    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    }
    if (method === "tools/call") {
      const { name, arguments: toolArgs = {} } = params || {};
      try {
        const text = await handleTool(name, toolArgs);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
      } catch (e) {
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `❌ ${e.message}` }], isError: true } };
      }
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (e) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message: `Internal error: ${e.message}` } };
  }
}

// ── SSE helper ────────────────────────────────────────────────────────────────
function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS — Claude Code can connect from any origin
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── Health check (no auth) ────────────────────────────────────────────────
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, version: VERSION, sessions: sessions.size }));
    return;
  }

  // ── SSE endpoint — Claude connects here ───────────────────────────────────
  if (req.method === "GET" && url.pathname === "/sse") {
    if (!authorized(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized — set Authorization: Bearer <MCP_TOKEN>" }));
      return;
    }

    const sessionId = randomUUID();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    });

    sessions.set(sessionId, res);
    process.stderr.write(`[wault-mcp-http] Session opened: ${sessionId}\n`);

    // Tell the client where to POST messages
    sseWrite(res, "endpoint", `/messages?sessionId=${sessionId}`);

    // Keepalive every 25 s so proxies don't drop the connection
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000);

    req.on("close", () => {
      clearInterval(ping);
      sessions.delete(sessionId);
      process.stderr.write(`[wault-mcp-http] Session closed: ${sessionId}\n`);
    });

    return;
  }

  // ── Messages endpoint — Claude POSTs JSON-RPC here ────────────────────────
  if (req.method === "POST" && url.pathname === "/messages") {
    const sessionId = url.searchParams.get("sessionId");
    const sseRes    = sessionId ? sessions.get(sessionId) : null;

    if (!sseRes) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found or expired" }));
      return;
    }

    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      // Acknowledge the POST immediately
      res.writeHead(202); res.end();

      let msg;
      try { msg = JSON.parse(body); } catch { return; }

      const response = await processMessage(msg);
      if (response) sseWrite(sseRes, "message", response);
    });

    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, "0.0.0.0", () => {
  process.stderr.write(`[wault-mcp-http] Listening on 0.0.0.0:${PORT}\n`);
  process.stderr.write(`[wault-mcp-http] SSE endpoint : /sse\n`);
  process.stderr.write(`[wault-mcp-http] WAULT API    : ${API_URL}\n`);
  process.stderr.write(`[wault-mcp-http] Auth         : ${MCP_TOKEN ? "bearer token required" : "OPEN — set MCP_TOKEN in production!"}\n`);
});
