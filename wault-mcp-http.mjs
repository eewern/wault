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
import { randomUUID, createHash } from "node:crypto";

const PORT      = parseInt(process.env.PORT      || "3335");
const MCP_TOKEN = (process.env.MCP_TOKEN         || "").trim();
const API_URL   = (process.env.WAULT_API_URL     || "http://127.0.0.1:3334").replace(/\/$/, "");
const API_TOKEN = (process.env.WAULT_API_TOKEN   || process.env.WERNOTION_API_TOKEN || "").trim();
const VERSION   = "2.0.0";

// ── Active SSE sessions ───────────────────────────────────────────────────────
const sessions = new Map();

// ── OAuth 2.0 state (in-memory; restarts invalidate tokens, which is fine) ───
const authCodes   = new Map(); // code → { clientId, redirectUri, codeChallenge, codeChallengeMethod, expiresAt }
const oauthTokens = new Set(); // issued access tokens

function genCode()  { return randomUUID().replace(/-/g, ""); }
function genToken() { return `wat_${randomUUID().replace(/-/g, "")}`; }

function verifyPKCE(verifier, challenge, method) {
  if (method === "S256") return createHash("sha256").update(verifier).digest("base64url") === challenge;
  return verifier === challenge; // plain
}

function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function authorized(req) {
  const h = (req.headers["authorization"] || "").trim();
  if (!h.startsWith("Bearer ")) return !MCP_TOKEN;
  const token = h.slice(7).trim();
  if (MCP_TOKEN && token === MCP_TOKEN) return true;
  if (oauthTokens.has(token)) return true;
  return false;
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
    case "callout":    return `> ${plain(block.text)}`;
    case "divider":    return "---";
    case "bullets":    return (block.items || []).map(i => `- ${plain(i.text)}`).join("\n");
    case "numbers":    return (block.items || []).map((i, n) => `${n + 1}. ${plain(i.text)}`).join("\n");
    case "checklist":  return (block.items || []).map(i => `- [${i.done ? "x" : " "}] ${plain(i.text)}`).join("\n");
    case "milestones": return (block.items || []).map(i => `milestone: ${plain(i.name)} | ${i.status || "pending"}`).join("\n");
    case "table": {
      const headers = block.headers || [];
      const sep     = headers.map(() => "---");
      const dataRows = (block.rows || []).map(r => `| ${(r.cells || []).join(" | ")} |`);
      return [`| ${headers.join(" | ")} |`, `| ${sep.join(" | ")} |`, ...dataRows].join("\n");
    }
    case "kpis":    return (block.items || []).map(i => `kpi: ${plain(i.label)} | ${plain(i.value)}${i.unit ? ` | ${i.unit}` : ""}`).join("\n");
    case "progress":return `progress: ${plain(block.label)} | ${block.value}/${block.total}`;
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

    // Heading
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) { blocks.push({ id: nid(), type: "heading", level: h[1].length, text: h[2].trim() }); i++; continue; }

    // Divider
    if (line.match(/^---+$/)) { blocks.push({ id: nid(), type: "divider" }); i++; continue; }

    // Callout: > text
    if (line.match(/^>\s+/)) { blocks.push({ id: nid(), type: "callout", text: line.replace(/^>\s+/, "").trim() }); i++; continue; }

    // KPI: kpi: Label | Value  or  kpi: Label | Value | Unit
    if (line.match(/^kpi:\s*/i)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^kpi:\s*/i)) {
        const parts = lines[i].replace(/^kpi:\s*/i, "").split("|").map(s => s.trim());
        items.push({ id: nid(), label: parts[0] || "", value: parts[1] || "", unit: parts[2] || "" });
        i++;
      }
      flush("kpis", items); continue;
    }

    // Milestone: milestone: Name | status  (status: pending | in-progress | done)
    if (line.match(/^milestone:\s*/i)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^milestone:\s*/i)) {
        const parts = lines[i].replace(/^milestone:\s*/i, "").split("|").map(s => s.trim());
        items.push({ id: nid(), name: parts[0] || "", status: parts[1] || "pending" });
        i++;
      }
      flush("milestones", items); continue;
    }

    // Progress: progress: Label | current/total
    if (line.match(/^progress:\s*/i)) {
      const rest  = line.replace(/^progress:\s*/i, "");
      const [lbl, frac] = rest.split("|").map(s => s.trim());
      const [val, tot]  = (frac || "0/0").split("/").map(s => parseInt(s.trim()) || 0);
      blocks.push({ id: nid(), type: "progress", label: lbl || "", value: val, total: tot });
      i++; continue;
    }

    // Markdown pipe table: | col | col |
    if (line.match(/^\|/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].match(/^\|/)) tableLines.push(lines[i++]);
      const parseRow = l => l.split("|").slice(1, -1).map(c => c.trim());
      const headers  = parseRow(tableLines[0] || "");
      const dataRows = tableLines.slice(2).map(l => ({ id: nid(), cells: parseRow(l) }));
      blocks.push({ id: nid(), type: "table", headers, rows: dataRows }); continue;
    }

    // Checklist: - [ ] or - [x]
    if (line.match(/^- \[[ x]\] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^- \[[ x]\] /)) {
        const m = lines[i].match(/^- \[([ x])\] (.*)/);
        items.push({ id: nid(), text: m[2].trim(), done: m[1] === "x", dueDate: "" });
        i++;
      }
      flush("checklist", items); continue;
    }

    // Bullets: - or * or •  (must come after checklist check)
    if (line.match(/^[-*•]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s+/) && !lines[i].match(/^- \[[ x]\] /))
        items.push({ id: nid(), text: lines[i++].replace(/^[-*•]\s+/, "").trim() });
      flush("bullets", items); continue;
    }

    // Numbered list
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

  // ── OAuth discovery ───────────────────────────────────────────────────────
  if (url.pathname === "/.well-known/oauth-authorization-server" || url.pathname === "/.well-known/openid-configuration") {
    const base = `https://${req.headers.host}`;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint:         `${base}/token`,
      registration_endpoint:  `${base}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["none"],
    }));
    return;
  }

  // ── OAuth dynamic client registration (RFC 7591) ──────────────────────────
  if (req.method === "POST" && url.pathname === "/register") {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      let meta = {};
      try { meta = JSON.parse(body); } catch {}
      const clientId = genCode();
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: meta.redirect_uris || [],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }));
    });
    return;
  }

  // ── OAuth authorize (GET = show form) ────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/authorize") {
    const clientId            = url.searchParams.get("client_id")             || "";
    const redirectUri         = url.searchParams.get("redirect_uri")          || "";
    const state               = url.searchParams.get("state")                 || "";
    const codeChallenge       = url.searchParams.get("code_challenge")        || "";
    const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "plain";

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to WAULT</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f0f;color:#e5e5e5;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:2rem;width:100%;max-width:360px}
h1{font-size:1.2rem;font-weight:600;margin-bottom:.4rem}
p{color:#888;font-size:.85rem;margin-bottom:1.5rem;line-height:1.5}
label{display:block;font-size:.8rem;color:#aaa;margin-bottom:.35rem}
input[type=password]{width:100%;background:#0f0f0f;border:1px solid #333;border-radius:8px;color:#e5e5e5;font-size:.9rem;padding:.6rem .8rem;outline:none}
input[type=password]:focus{border-color:#6366f1}
button{width:100%;margin-top:1rem;background:#6366f1;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:.95rem;font-weight:600;padding:.65rem}
button:hover{background:#4f52e0}
.err{color:#f87171;font-size:.8rem;margin-top:.75rem}
</style></head>
<body><div class="card">
<h1>Connect WAULT to Claude</h1>
<p>Enter your WAULT team token to grant Claude access to your workspaces.</p>
<form method="POST" action="/authorize">
<input type="hidden" name="client_id" value="${escHtml(clientId)}">
<input type="hidden" name="redirect_uri" value="${escHtml(redirectUri)}">
<input type="hidden" name="state" value="${escHtml(state)}">
<input type="hidden" name="code_challenge" value="${escHtml(codeChallenge)}">
<input type="hidden" name="code_challenge_method" value="${escHtml(codeChallengeMethod)}">
<label for="tok">Team Token</label>
<input type="password" id="tok" name="token" placeholder="wault_team_…" autocomplete="current-password" autofocus>
<button type="submit">Authorize</button>
</form></div></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  // ── OAuth authorize (POST = validate token, issue code) ──────────────────
  if (req.method === "POST" && url.pathname === "/authorize") {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      const p                   = new URLSearchParams(body);
      const token               = p.get("token")                || "";
      const clientId            = p.get("client_id")            || "";
      const redirectUri         = p.get("redirect_uri")         || "";
      const state               = p.get("state")                || "";
      const codeChallenge       = p.get("code_challenge")       || "";
      const codeChallengeMethod = p.get("code_challenge_method")|| "plain";

      if (!MCP_TOKEN || token !== MCP_TOKEN) {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Invalid token. Please go back and try again.");
        return;
      }

      const code = genCode();
      authCodes.set(code, { clientId, redirectUri, codeChallenge, codeChallengeMethod, expiresAt: Date.now() + 600_000 });

      const dest = new URL(redirectUri);
      dest.searchParams.set("code", code);
      if (state) dest.searchParams.set("state", state);
      res.writeHead(302, { "Location": dest.toString() });
      res.end();
    });
    return;
  }

  // ── OAuth token exchange ──────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/token") {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      const p            = new URLSearchParams(body);
      const grantType    = p.get("grant_type")    || "";
      const code         = p.get("code")           || "";
      const codeVerifier = p.get("code_verifier")  || "";
      const redirectUri  = p.get("redirect_uri")   || "";

      const fail = (err, desc) => {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err, error_description: desc }));
      };

      if (grantType !== "authorization_code") return fail("unsupported_grant_type");

      const stored = authCodes.get(code);
      if (!stored || Date.now() > stored.expiresAt) { authCodes.delete(code); return fail("invalid_grant", "code expired or unknown"); }
      if (stored.redirectUri !== redirectUri)        { return fail("invalid_grant", "redirect_uri mismatch"); }
      if (stored.codeChallenge && !verifyPKCE(codeVerifier, stored.codeChallenge, stored.codeChallengeMethod)) {
        return fail("invalid_grant", "PKCE verification failed");
      }

      authCodes.delete(code);
      const accessToken = genToken();
      oauthTokens.add(accessToken);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: accessToken, token_type: "Bearer", expires_in: 31536000 }));
    });
    return;
  }

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
