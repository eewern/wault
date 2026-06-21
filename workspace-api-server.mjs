import dotenv from "dotenv";
dotenv.config();

import http from "node:http";
import https from "node:https";
import { createSign } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.WORKSPACE_API_PORT || 3334);
const HOST = process.env.WORKSPACE_API_HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const STORE_PATH = resolve(process.env.WORKSPACE_API_STORE || `${__dirname}/workspace-api-store.json`);
const API_TOKEN = process.env.WORKSPACE_API_TOKEN || "";

// Firebase Database URL for API-key validation (optional — set if hosted).
// Format: https://<project>-default-rtdb.firebaseio.com
const FIREBASE_DB_URL = (process.env.FIREBASE_DATABASE_URL || "").replace(/\/$/, "");
const FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "";
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";

// In-memory cache of validated API keys → uid to avoid hitting Firebase on every request.
const apiKeyCache = new Map(); // key → { uid, email, expiresAt }
const KEY_CACHE_TTL_MS = 30 * 1000; // Keep revocation responsive.
let firebaseAccessToken = null;

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createServiceAccountJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.private_key);
  return `${unsigned}.${base64url(signature)}`;
}

async function loadFirebaseServiceAccount() {
  if (FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  if (FIREBASE_SERVICE_ACCOUNT_PATH) return JSON.parse(await readFile(FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
  return null;
}

async function getFirebaseAccessToken() {
  if (firebaseAccessToken && firebaseAccessToken.expiresAt > Date.now() + 60_000) {
    return firebaseAccessToken.value;
  }
  const serviceAccount = await loadFirebaseServiceAccount();
  if (!serviceAccount) return "";

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createServiceAccountJwt(serviceAccount),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Firebase auth failed: ${res.status} ${JSON.stringify(body)}`);
  }
  firebaseAccessToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in || 3600)) * 1000,
  };
  return firebaseAccessToken.value;
}

async function firebaseGet(path, searchParams = {}) {
  const accessToken = await getFirebaseAccessToken();
  const url = new URL(`${FIREBASE_DB_URL}/${path.replace(/^\/+/, "")}.json`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return await new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const opts = accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {};
    lib.get(url, opts, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { resolve(null); }
      });
    }).on("error", reject);
  });
}

async function firebasePut(path, data) {
  const accessToken = await getFirebaseAccessToken();
  const url = new URL(`${FIREBASE_DB_URL}/${path.replace(/^\/+/, "")}.json`);
  const body = JSON.stringify(data);
  return await new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const opts = {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
    };
    const req = lib.request(url, opts, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { resolve(null); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function resolveApiKey(token) {
  if (!token || !token.startsWith("wn_")) return null;
  const cached = apiKeyCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached;

  if (!FIREBASE_DB_URL) return null; // Firebase not configured — skip key lookup

  // Query Firebase REST: GET /apiKeys.json?orderBy="key"&equalTo="wn_..."
  try {
    const result = await firebaseGet("apiKeys", {
      orderBy: JSON.stringify("key"),
      equalTo: JSON.stringify(token),
    });
    if (!result || typeof result !== "object" || result.error) return null;
    const entry = Object.entries(result).find(([, data]) => data?.key === token); // [uid, { key, email, ... }]
    if (!entry) return null;
    const [uid, data] = entry;
    const access = await firebaseGet(`access/${uid}`);
    if (!access || typeof access !== "object" || access.error) return null;
    const role = access.role === "owner" ? "owner" : "member";
    const info = {
      uid,
      email: access.email || data.email || "",
      role,
      expiresAt: Date.now() + KEY_CACHE_TTL_MS,
    };
    apiKeyCache.set(token, info);
    return info;
  } catch { return null; }
}

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

// Cap request bodies so a single huge/streamed payload can't exhaust memory.
const MAX_BODY_BYTES = Number(process.env.WORKSPACE_API_MAX_BODY || 10 * 1024 * 1024); // 10 MB

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
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
  // If Firebase is configured, use it as the primary store
  if (FIREBASE_DB_URL && (FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT_PATH)) {
    try {
      const data = await firebaseGet("store");
      if (data && typeof data === "object" && !data.error) {
        return {
          version: 1,
          workspaces: data.workspaces || {},
          updatedAt: data.updatedAt || null,
        };
      }
    } catch (e) {
      console.error("Firebase read failed, falling back to local store:", e.message);
    }
  }
  // Fall back to local JSON
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
  const nextStore = { ...store, version: 1, updatedAt: now() };
  // Write to Firebase if configured
  if (FIREBASE_DB_URL && (FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT_PATH)) {
    try {
      await firebasePut("store", nextStore);
    } catch (e) {
      console.error("Firebase write failed:", e.message);
    }
  }
  // Always write local JSON as backup
  await mkdir(dirname(STORE_PATH), { recursive: true });
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

async function requireAuth(req) {
  const auth = req.headers.authorization || "";
  const token = (auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-workspace-api-token"] || "").trim();

  // 1. No auth configured at all (local dev) → allow
  if (!API_TOKEN && !FIREBASE_DB_URL) return { uid: null };

  // 2. Static token (local dev or simple single-user hosting)
  if (API_TOKEN && token === API_TOKEN) return { uid: null };

  // 3. Per-user Firebase API key (wn_...)
  if (token.startsWith("wn_")) {
    const info = await resolveApiKey(token);
    if (info) return info; // { uid, email }
  }

  const error = new Error("Unauthorized. Provide a valid API key in the Authorization: Bearer header.");
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
    send(res, 200, {
      ok: true,
      storePath: STORE_PATH,
      firebaseDatabaseConfigured: Boolean(FIREBASE_DB_URL),
      firebaseServiceAccountConfigured: Boolean(FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT_PATH),
      staticTokenConfigured: Boolean(API_TOKEN),
    });
    return;
  }

  await requireAuth(req);
  const store = await readStore();

  // Convenience: /api/workspace/active → most-recently-updated workspace
  if (parts[0] === "api" && parts[1] === "workspace" && parts[2] === "active" && req.method === "GET") {
    const workspaces = Object.values(store.workspaces)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (!workspaces.length) { send(res, 404, { error: "No workspaces found." }); return; }
    send(res, 200, { workspace: workspaces[0] });
    return;
  }

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
