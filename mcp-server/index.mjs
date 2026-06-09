#!/usr/bin/env node
/**
 * WAULT MCP server — built with the official @modelcontextprotocol/sdk
 * Following https://modelcontextprotocol.io/docs/develop/build-server
 *
 * Exposes your WAULT workspaces and pages to Claude (Desktop / Code) over the
 * MCP stdio transport. It is a thin, well-typed wrapper over the existing WAULT
 * REST API (workspace-api-server.mjs / the Netlify deployment).
 *
 * ── Configure ──────────────────────────────────────────────────────────────
 *   WAULT_API_URL    base URL of the API (default: https://usewault.netlify.app)
 *   WAULT_API_TOKEN  your personal API key (wn_...) — generate it in
 *                        WAULT → Settings → Claude MCP & API key
 *
 * ── Run ────────────────────────────────────────────────────────────────────
 *   cd mcp-server && npm install
 *   WAULT_API_TOKEN=wn_xxx node index.mjs        # stdio server
 *   npm run inspect                                    # MCP Inspector UI
 */

import http from "node:http";
import https from "node:https";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = (process.env.WAULT_API_URL || "https://usewault.netlify.app").replace(/\/$/, "");
const API_TOKEN = process.env.WAULT_API_TOKEN || "";

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
        Accept: "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
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
  switch (block?.type) {
    case "heading":    return `${"#".repeat(block.level || 1)} ${plain(block.text)}`;
    case "text":       return plain(block.text);
    case "callout":    return `💡 ${plain(block.text)}`;
    case "divider":    return "---";
    case "bullets":    return (block.items || []).map((i) => `• ${plain(i.text)}`).join("\n");
    case "numbers":    return (block.items || []).map((i, n) => `${n + 1}. ${plain(i.text)}`).join("\n");
    case "checklist":  return (block.items || []).map((i) => `- [${i.done ? "x" : " "}] ${plain(i.text)}`).join("\n");
    case "milestones": return (block.items || []).map((i) => `- [${i.status === "done" ? "x" : " "}] ${plain(i.name)} (${i.status})`).join("\n");
    case "table": {
      const rows = [block.headers || [], ...(block.rows || []).map((r) => r.cells || [])];
      return rows.map((r) => r.map(plain).join(" | ")).join("\n");
    }
    case "kpis":     return (block.items || []).map((i) => `${plain(i.label)}: ${plain(i.value)}${i.unit || ""}`).join(" | ");
    case "progress": return `${plain(block.label)}: ${block.value}/${block.total}`;
    case "subpage":  return `↳ [sub-page: ${block.pageId}]`;
    default:         return plain(block?.text);
  }
}

function pageToMarkdown(page) {
  const title = String(page.title || "Untitled").replace(/<[^>]*>/g, "");
  const blocks = (page.blocks || []).map(blockToText).filter(Boolean).join("\n\n");
  return `# ${title}\n\n${blocks}`;
}

// ─── Markdown → blocks (mirrors the app's parser) ─────────────────────────────
function nid() { return `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function parseMarkdownToBlocks(md) {
  const lines = String(md || "").split("\n");
  const blocks = [];
  let i = 0;
  const flush = (type, items) => { if (items.length) blocks.push({ id: nid(), type, items }); };

  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) { blocks.push({ id: nid(), type: "heading", level: h[1].length, text: h[2].trim() }); i++; continue; }
    if (/^---+$|^\*\*\*+$/.test(line)) { blocks.push({ id: nid(), type: "divider" }); i++; continue; }

    if (/^- \[[ x]\] /.test(line)) {
      const items = [];
      while (i < lines.length && /^- \[[ x]\] /.test(lines[i])) {
        const m = lines[i].match(/^- \[([ x])\] (.*)/);
        items.push({ id: nid(), text: m[2].trim(), done: m[1] === "x", dueDate: "" });
        i++;
      }
      flush("checklist", items); continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i]) && !/^- \[[ x]\] /.test(lines[i])) {
        items.push({ id: nid(), text: lines[i].replace(/^[-*•]\s+/, "").trim() });
        i++;
      }
      flush("bullets", items); continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
        items.push({ id: nid(), text: lines[i].replace(/^\d+[.)]\s+/, "").trim() });
        i++;
      }
      flush("numbers", items); continue;
    }
    if (line.trim()) blocks.push({ id: nid(), type: "text", text: line.trim() });
    i++;
  }
  return blocks;
}

// ─── resolve workspace id (use the active one if none given) ──────────────────
async function resolveWorkspaceId(given) {
  if (given) return given;
  try {
    const r = await apiRequest("GET", "/api/workspace/active");
    if (r.status === 200 && r.body?.workspace?.id) return r.body.workspace.id;
  } catch {}
  const r = await apiRequest("GET", "/api/workspaces");
  const list = r.body?.workspaces || [];
  if (!list.length) throw new Error(`No workspaces found. Is the WAULT API reachable at ${API_URL}, and is your API key valid?`);
  return list[0].id;
}

const ok = (text) => ({ content: [{ type: "text", text }] });
const fail = (text) => ({ content: [{ type: "text", text }], isError: true });

// ─── MCP server ──────────────────────────────────────────────────────────────
const server = new McpServer({ name: "wault", version: "1.0.0" });

server.registerTool(
  "list_workspaces",
  {
    title: "List workspaces",
    description: "List all available WAULT workspaces with their IDs, names, and page counts.",
    inputSchema: {},
  },
  async () => {
    const r = await apiRequest("GET", "/api/workspaces");
    if (r.status !== 200) return fail(`API error ${r.status}: ${JSON.stringify(r.body)}`);
    const workspaces = r.body.workspaces || [];
    if (!workspaces.length) return ok("No workspaces found. Make sure the API server is running and synced, and your API key is valid.");
    return ok(
      `Found ${workspaces.length} workspace(s):\n\n` +
      workspaces.map((w) => `• ${w.name} (id: ${w.id}) — ${w.pageCount} pages, updated: ${w.updatedAt || "never"}`).join("\n")
    );
  }
);

server.registerTool(
  "list_pages",
  {
    title: "List pages",
    description: "List all pages in a workspace (IDs, titles, nesting). Omit workspace_id to use the active workspace.",
    inputSchema: { workspace_id: z.string().optional().describe("Workspace ID (omit to use the active workspace)") },
  },
  async ({ workspace_id }) => {
    const wsId = await resolveWorkspaceId(workspace_id);
    const r = await apiRequest("GET", `/api/workspaces/${wsId}/pages`);
    if (r.status !== 200) return fail(`API error ${r.status}`);
    const pages = r.body.pages || [];
    if (!pages.length) return ok(`No pages found in workspace "${wsId}".`);
    const lines = pages.map((p) => `${p.parentId ? "  " : ""}• [${p.id}] ${String(p.title || "Untitled").replace(/<[^>]*>/g, "")}`);
    return ok(`${pages.length} pages in workspace "${wsId}":\n\n${lines.join("\n")}`);
  }
);

server.registerTool(
  "read_page",
  {
    title: "Read page",
    description: "Read the full content of a page (title + all blocks) as readable Markdown.",
    inputSchema: {
      page_id: z.string().describe("Page ID"),
      workspace_id: z.string().optional().describe("Workspace ID (omit to use the active workspace)"),
    },
  },
  async ({ page_id, workspace_id }) => {
    const wsId = await resolveWorkspaceId(workspace_id);
    const r = await apiRequest("GET", `/api/workspaces/${wsId}/pages/${page_id}`);
    if (r.status === 404) return fail(`Page "${page_id}" not found.`);
    if (r.status !== 200) return fail(`API error ${r.status}`);
    return ok(pageToMarkdown(r.body.page || r.body));
  }
);

server.registerTool(
  "search_pages",
  {
    title: "Search pages",
    description: "Search pages by title or text content. Returns matching page IDs, titles, and snippets.",
    inputSchema: {
      query: z.string().describe("Search query"),
      workspace_id: z.string().optional().describe("Limit to one workspace (omit to search all)"),
      max_results: z.number().int().positive().optional().describe("Maximum results (default 10)"),
    },
  },
  async ({ query, workspace_id, max_results }) => {
    const q = String(query || "").toLowerCase();
    if (!q) return fail("Query must not be empty.");
    const max = max_results || 10;
    const wsListR = await apiRequest("GET", "/api/workspaces");
    const workspaces = (wsListR.body.workspaces || []).filter((w) => !workspace_id || w.id === workspace_id);
    const results = [];
    for (const ws of workspaces) {
      const r = await apiRequest("GET", `/api/workspaces/${ws.id}/pages`);
      for (const page of r.body.pages || []) {
        const titleText = String(page.title || "").replace(/<[^>]*>/g, "").toLowerCase();
        const blockText = (page.blocks || []).map(blockToText).join(" ").toLowerCase();
        if (titleText.includes(q) || blockText.includes(q)) {
          results.push({
            wsName: ws.name,
            id: page.id,
            title: String(page.title || "Untitled").replace(/<[^>]*>/g, ""),
            snippet: blockText.replace(/\s+/g, " ").trim().slice(0, 160),
          });
          if (results.length >= max) break;
        }
      }
      if (results.length >= max) break;
    }
    if (!results.length) return ok(`No pages found matching "${query}".`);
    return ok(results.map((r) => `[${r.wsName}] "${r.title}" (id: ${r.id})\n  ${r.snippet}…`).join("\n\n"));
  }
);

server.registerTool(
  "create_page",
  {
    title: "Create page",
    description: "Create a new page with a title and optional Markdown content (# headings, - bullets, 1. numbers, - [ ] / - [x] checklists).",
    inputSchema: {
      title: z.string().describe("Page title"),
      markdown: z.string().optional().describe("Page content as Markdown"),
      workspace_id: z.string().optional().describe("Workspace ID (omit to use the active workspace)"),
      parent_id: z.string().optional().describe("Parent page ID (omit for a top-level page)"),
    },
  },
  async ({ title, markdown, workspace_id, parent_id }) => {
    const wsId = await resolveWorkspaceId(workspace_id);
    const blocks = markdown ? parseMarkdownToBlocks(markdown) : [{ id: nid(), type: "text", text: "" }];
    const body = { title: title || "Untitled", blocks, ...(parent_id ? { parentId: parent_id } : {}) };
    const r = await apiRequest("POST", `/api/workspaces/${wsId}/pages`, body);
    if (r.status !== 201 && r.status !== 200) return fail(`API error ${r.status}: ${JSON.stringify(r.body)}`);
    const page = r.body.page || r.body;
    return ok(`✅ Created page "${title}" (id: ${page.id}) in workspace "${wsId}".`);
  }
);

server.registerTool(
  "update_page",
  {
    title: "Update page",
    description: "Update a page's title and/or replace its content. Provide title and/or markdown.",
    inputSchema: {
      page_id: z.string().describe("Page ID"),
      title: z.string().optional().describe("New title (omit to keep existing)"),
      markdown: z.string().optional().describe("New full content as Markdown (replaces all blocks)"),
      workspace_id: z.string().optional().describe("Workspace ID (omit to use the active workspace)"),
    },
  },
  async ({ page_id, title, markdown, workspace_id }) => {
    const wsId = await resolveWorkspaceId(workspace_id);
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (markdown !== undefined) patch.blocks = parseMarkdownToBlocks(markdown);
    if (!Object.keys(patch).length) return ok("Nothing to update — provide title and/or markdown.");
    const r = await apiRequest("PATCH", `/api/workspaces/${wsId}/pages/${page_id}`, patch);
    if (r.status === 404) return fail(`Page "${page_id}" not found.`);
    if (r.status !== 200) return fail(`API error ${r.status}: ${JSON.stringify(r.body)}`);
    return ok(`✅ Updated page "${page_id}".`);
  }
);

server.registerTool(
  "append_to_page",
  {
    title: "Append to page",
    description: "Append Markdown content to the end of a page without replacing existing content.",
    inputSchema: {
      page_id: z.string().describe("Page ID"),
      markdown: z.string().describe("Markdown content to append"),
      workspace_id: z.string().optional().describe("Workspace ID (omit to use the active workspace)"),
    },
  },
  async ({ page_id, markdown, workspace_id }) => {
    const wsId = await resolveWorkspaceId(workspace_id);
    const existing = await apiRequest("GET", `/api/workspaces/${wsId}/pages/${page_id}`);
    if (existing.status === 404) return fail(`Page "${page_id}" not found.`);
    const page = existing.body.page || existing.body;
    const newBlocks = parseMarkdownToBlocks(markdown);
    const merged = [...(page.blocks || []), ...newBlocks];
    const r = await apiRequest("PATCH", `/api/workspaces/${wsId}/pages/${page_id}`, { blocks: merged });
    if (r.status !== 200) return fail(`API error ${r.status}: ${JSON.stringify(r.body)}`);
    return ok(`✅ Appended ${newBlocks.length} block(s) to page "${page_id}".`);
  }
);

// ─── start (stdio) ────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`WAULT MCP server running on stdio — API: ${API_URL}${API_TOKEN ? "" : " (no API token set!)"}`);
}

main().catch((e) => {
  console.error("Fatal error in WAULT MCP server:", e);
  process.exit(1);
});
