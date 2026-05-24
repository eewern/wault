import http from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.WORKSPACE_API_PORT || 3334);
const HOST = process.env.WORKSPACE_API_HOST || "127.0.0.1";
const STORE_PATH = resolve(process.env.WORKSPACE_API_STORE || `${__dirname}/workspace-api-store.json`);
const API_TOKEN = process.env.WORKSPACE_API_TOKEN || "";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": process.env.WORKSPACE_API_ORIGIN || "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-workspace-api-token",
  "access-control-max-age": "86400",
};

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const createId = () => `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function send(res, status, body = {}) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(body, null, 2));
}

function sendNoContent(res) {
  res.writeHead(204, jsonHeaders);
  res.end();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function readStore() {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      workspaces: parsed.workspaces || {},
      updatedAt: parsed.updatedAt || null,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { version: 1, workspaces: {}, updatedAt: null };
  }
}

async function writeStore(store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  const nextStore = { ...store, version: 1, updatedAt: now() };
  const tmpPath = `${STORE_PATH}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmpPath, JSON.stringify(nextStore, null, 2));
  await rename(tmpPath, STORE_PATH);
}

function workspaceSummary(workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    source: workspace.source || "api",
    pageCount: Object.keys(workspace.data?.pages || {}).length,
    currentPageId: workspace.data?.currentPageId || null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function requireAuth(req) {
  if (!API_TOKEN) return;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-workspace-api-token"];
  if (token === API_TOKEN) return;
  const error = new Error("Unauthorized.");
  error.statusCode = 401;
  throw error;
}

function splitPath(req) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return { url, parts };
}

function ensureWorkspace(store, id) {
  const workspace = store.workspaces[id];
  if (!workspace) {
    const error = new Error(`Workspace not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }
  return workspace;
}

function ensurePage(workspace, pageId) {
  const page = workspace.data?.pages?.[pageId];
  if (!page) {
    const error = new Error(`Page not found: ${pageId}`);
    error.statusCode = 404;
    throw error;
  }
  return page;
}

function ensureBlock(page, blockId) {
  const block = (page.blocks || []).find((item) => item.id === blockId);
  if (!block) {
    const error = new Error(`Block not found: ${blockId}`);
    error.statusCode = 404;
    throw error;
  }
  return block;
}

function touchWorkspace(workspace) {
  workspace.updatedAt = now();
  return workspace;
}

async function handleWorkspaces(req, res, store, parts) {
  if (parts.length === 2 && req.method === "GET") {
    const workspaces = Object.values(store.workspaces)
      .map(workspaceSummary)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    send(res, 200, { workspaces });
    return true;
  }

  if (parts.length === 2 && req.method === "POST") {
    const body = await readBody(req);
    const id = body.id || createId();
    if (store.workspaces[id]) {
      const error = new Error(`Workspace already exists: ${id}`);
      error.statusCode = 409;
      throw error;
    }
    const workspace = {
      id,
      name: body.name || "Untitled Workspace",
      source: body.source || "api",
      data: body.data || { pages: {}, rootOrder: [], childOrder: {}, currentPageId: null },
      createdAt: now(),
      updatedAt: now(),
    };
    store.workspaces[id] = workspace;
    await writeStore(store);
    send(res, 201, { workspace });
    return true;
  }

  if (parts.length >= 3) {
    const id = parts[2];

    if (parts.length === 3 && req.method === "PUT") {
      const body = await readBody(req);
      const isCreate = !store.workspaces[id];
      const workspace = store.workspaces[id] || {
        id,
        name: body.name || "Untitled Workspace",
        source: body.source || "api",
        data: body.data || { pages: {}, rootOrder: [], childOrder: {}, currentPageId: null },
        createdAt: now(),
        updatedAt: now(),
      };
      if (body.name !== undefined) workspace.name = body.name;
      if (body.source !== undefined) workspace.source = body.source;
      if (body.data !== undefined) workspace.data = body.data;
      store.workspaces[id] = touchWorkspace(workspace);
      await writeStore(store);
      send(res, isCreate ? 201 : 200, { workspace: store.workspaces[id] });
      return true;
    }

    const workspace = ensureWorkspace(store, id);

    if (parts.length === 3 && req.method === "GET") {
      send(res, 200, { workspace });
      return true;
    }

    if (parts.length === 3 && req.method === "PATCH") {
      const body = await readBody(req);
      if (body.name !== undefined) workspace.name = body.name;
      if (body.source !== undefined) workspace.source = body.source;
      if (body.data !== undefined) workspace.data = body.data;
      touchWorkspace(workspace);
      await writeStore(store);
      send(res, 200, { workspace });
      return true;
    }

    if (parts.length === 3 && req.method === "DELETE") {
      delete store.workspaces[id];
      await writeStore(store);
      sendNoContent(res);
      return true;
    }

    if (parts.length === 4 && parts[3] === "import" && req.method === "POST") {
      const body = await readBody(req);
      workspace.data = body.data || body;
      if (body.name) workspace.name = body.name;
      workspace.source = body.source || workspace.source || "api";
      touchWorkspace(workspace);
      await writeStore(store);
      send(res, 200, { workspace });
      return true;
    }

    if (parts[3] === "pages") {
      return await handlePages(req, res, store, workspace, parts);
    }
  }

  return false;
}

async function handlePages(req, res, store, workspace, parts) {
  const data = workspace.data || { pages: {}, rootOrder: [], childOrder: {}, currentPageId: null };
  workspace.data = data;
  data.pages = data.pages || {};
  data.rootOrder = data.rootOrder || [];
  data.childOrder = data.childOrder || {};

  if (parts.length === 4 && req.method === "GET") {
    send(res, 200, { pages: Object.values(data.pages) });
    return true;
  }

  if (parts.length === 4 && req.method === "POST") {
    const body = await readBody(req);
    const page = {
      id: body.id || `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      parentId: body.parentId || null,
      title: body.title || "Untitled",
      icon: body.icon || "page",
      date: body.date || "",
      blocks: Array.isArray(body.blocks) ? body.blocks : [],
      ...body,
    };
    data.pages[page.id] = page;
    if (page.parentId) {
      data.childOrder[page.parentId] = [...(data.childOrder[page.parentId] || []), page.id];
    } else if (!data.rootOrder.includes(page.id)) {
      data.rootOrder.push(page.id);
    }
    data.currentPageId = page.id;
    touchWorkspace(workspace);
    await writeStore(store);
    send(res, 201, { page, workspace: workspaceSummary(workspace) });
    return true;
  }

  if (parts.length >= 5) {
    const pageId = parts[4];
    const page = ensurePage(workspace, pageId);

    if (parts.length === 5 && req.method === "GET") {
      send(res, 200, { page });
      return true;
    }

    if (parts.length === 5 && (req.method === "PUT" || req.method === "PATCH")) {
      const body = await readBody(req);
      data.pages[pageId] = { ...page, ...body, id: pageId };
      touchWorkspace(workspace);
      await writeStore(store);
      send(res, 200, { page: data.pages[pageId] });
      return true;
    }

    if (parts.length === 5 && req.method === "DELETE") {
      delete data.pages[pageId];
      data.rootOrder = data.rootOrder.filter((id) => id !== pageId);
      Object.keys(data.childOrder).forEach((parentId) => {
        data.childOrder[parentId] = data.childOrder[parentId].filter((id) => id !== pageId);
      });
      if (data.currentPageId === pageId) data.currentPageId = data.rootOrder[0] || Object.keys(data.pages)[0] || null;
      touchWorkspace(workspace);
      await writeStore(store);
      sendNoContent(res);
      return true;
    }

    if (parts[5] === "blocks") {
      return await handleBlocks(req, res, store, workspace, page, parts);
    }
  }

  return false;
}

async function handleBlocks(req, res, store, workspace, page, parts) {
  page.blocks = Array.isArray(page.blocks) ? page.blocks : [];

  if (parts.length === 6 && req.method === "GET") {
    send(res, 200, { blocks: page.blocks });
    return true;
  }

  if (parts.length === 6 && req.method === "POST") {
    const body = await readBody(req);
    const block = { id: body.id || `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, type: body.type || "text", ...body };
    const afterBlockId = body.afterBlockId;
    const index = afterBlockId ? page.blocks.findIndex((item) => item.id === afterBlockId) + 1 : page.blocks.length;
    page.blocks.splice(index > 0 ? index : page.blocks.length, 0, block);
    touchWorkspace(workspace);
    await writeStore(store);
    send(res, 201, { block });
    return true;
  }

  if (parts.length === 7) {
    const blockId = parts[6];
    const block = ensureBlock(page, blockId);

    if (req.method === "GET") {
      send(res, 200, { block });
      return true;
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const body = await readBody(req);
      page.blocks = page.blocks.map((item) => item.id === blockId ? { ...item, ...body, id: blockId } : item);
      touchWorkspace(workspace);
      await writeStore(store);
      send(res, 200, { block: page.blocks.find((item) => item.id === blockId) });
      return true;
    }

    if (req.method === "DELETE") {
      page.blocks = page.blocks.filter((item) => item.id !== blockId);
      touchWorkspace(workspace);
      await writeStore(store);
      sendNoContent(res);
      return true;
    }
  }

  return false;
}

async function router(req, res) {
  if (req.method === "OPTIONS") {
    sendNoContent(res);
    return;
  }

  const { parts } = splitPath(req);
  if (parts.length === 1 && parts[0] === "health" && req.method === "GET") {
    send(res, 200, { ok: true, storePath: STORE_PATH });
    return;
  }

  requireAuth(req);
  const store = await readStore();

  if (parts[0] === "api" && parts[1] === "workspaces") {
    const handled = await handleWorkspaces(req, res, store, parts);
    if (handled) return;
  }

  send(res, 404, { error: "Not found." });
}

const server = http.createServer((req, res) => {
  router(req, res).catch((error) => {
    const status = error.statusCode || 500;
    send(res, status, { error: error.message || "Server error." });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Workspace API listening on http://${HOST}:${PORT}`);
  console.log(`Store: ${STORE_PATH}`);
  if (API_TOKEN) console.log("Auth: bearer token required");
});
