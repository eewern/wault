// Two-way sync bridge between the browser workspace and the local API server.
// Push: whenever workspace data changes in localStorage → PUT to API server.
// Pull: every 8 s poll the API server; if an external tool (e.g. Claude) wrote
//       newer data, fire a CustomEvent so the React app can apply the update.
(function () {
  const params  = new URLSearchParams(window.location.search);
  const apiUrl  = (params.get("api") || window.WORKSPACE_API_URL || "").replace(/\/$/, "");
  // Set only after Firebase sign-in. Never persist this token or accept it via
  // URL parameters (URLs leak into browser history, logs, and referrers).
  let apiToken = "";
  if (!apiUrl) return;

  const DATA_PREFIX        = "workspace_v4_data_";
  const WORKSPACES_KEY     = "workspace_v4_workspaces";
  const ACTIVE_KEY         = "workspace_v4_active_workspace";
  const POLL_INTERVAL_MS   = 8000;
  const PUSH_DEBOUNCE_MS   = 700;

  // Track what we last pushed so we don't re-push identical data
  const lastPushedJson   = new Map();
  // Track updatedAt from the last pull so we only apply genuinely new API data
  const lastPulledAt     = new Map();

  let pushTimer = null;

  const headers = () => {
    const h = { "content-type": "application/json" };
    if (apiToken) h.authorization = `Bearer ${apiToken}`;
    return h;
  };

  function setApiToken(token) {
    apiToken = String(token || "").trim();
  }

  const readJson = (key, fallback) => {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch { return fallback; }
  };

  const workspaceMeta = (id) => {
    const list = readJson(WORKSPACES_KEY, []);
    return (list || []).find(w => w.id === id) || {};
  };

  // ── Push ───────────────────────────────────────────────────────────────────

  async function pushWorkspace(id) {
    if (!id) return;
    const raw = localStorage.getItem(`${DATA_PREFIX}${id}`);
    if (!raw) return;
    if (lastPushedJson.get(id) === raw) return;   // nothing changed
    const meta = workspaceMeta(id);
    try {
      const res = await fetch(`${apiUrl}/api/workspaces/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({
          id,
          name: meta.name || id,
          source: "browser",           // tag so the pull knows we wrote this
          data: JSON.parse(raw),
        }),
      });
      if (!res.ok) return;
      const { workspace } = await res.json();
      lastPushedJson.set(id, raw);
      lastPulledAt.set(id, workspace?.updatedAt || null);  // don't echo our own push back
    } catch { /* API server not running — silently ignore */ }
  }

  async function pushAll() {
    const ids = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(DATA_PREFIX)) ids.push(k.slice(DATA_PREFIX.length));
    }
    for (const id of ids) await pushWorkspace(id);
  }

  function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushAll, PUSH_DEBOUNCE_MS);
  }

  // ── Pull ───────────────────────────────────────────────────────────────────

  async function pullWorkspace(id) {
    if (!id) return;
    try {
      const res = await fetch(`${apiUrl}/api/workspaces/${encodeURIComponent(id)}`, { headers: headers() });
      if (!res.ok) return;
      const { workspace } = await res.json();
      if (!workspace?.data) return;

      // Only apply if the server has newer data than we last pushed/pulled
      const serverAt = workspace.updatedAt || "";
      if (serverAt && serverAt === lastPulledAt.get(id)) return;        // no change
      if (workspace.source === "browser") {                             // our own push
        lastPulledAt.set(id, serverAt);
        return;
      }

      // External write (Claude or another tool) — apply it
      const newJson = JSON.stringify(workspace.data);
      localStorage.setItem(`${DATA_PREFIX}${id}`, newJson);
      lastPushedJson.set(id, newJson);   // so the push hook doesn't echo it back
      lastPulledAt.set(id, serverAt);

      // Notify the React app
      window.dispatchEvent(new CustomEvent("workspace-api-update", {
        detail: { workspaceId: id, data: workspace.data },
      }));

      console.log(`📥 Workspace updated via API (Claude): ${id}`);
    } catch { /* silently ignore when server is offline */ }
  }

  async function pollActive() {
    const activeId = localStorage.getItem(ACTIVE_KEY);
    if (activeId) await pullWorkspace(activeId);
  }

  // ── Content sync is handled by firebase-sync.mjs (real-time, echo-suppressed,
  //    and it preserves the block your cursor is in). This bridge's push/pull/poll
  //    duplicated that path and FOUGHT it: the 8s pull called setData() with the
  //    pre-edit server snapshot, making freshly-typed blocks vanish then reappear,
  //    and reverting table drags. So we DISABLE the polling/push loops here.
  //    Claude/MCP edits still reach the app: they're written to Firebase by the API
  //    server and picked up live by firebase-sync's onWorkspaceUpdate listener.
  //    The bridge stays loaded only for listWorkspaces() (discovery) + deleteWorkspace().
  //
  //    (Intentionally NOT hooking localStorage.setItem and NOT starting setInterval
  //     pollActive / initial pushAll.)

  // List every workspace the server (Firebase-backed) knows about. The Railway
  // API filters this by the signed-in Firebase API key: shared workspaces for
  // approved team members, plus private workspaces owned by this user.
  // Used by the app to DISCOVER workspaces created on other devices / by the API —
  // the web app's own list is per-browser, and Firebase rules only allow reading
  // individual /workspaces/{id}, not the whole node, so we go through the API
  // (admin service account) for the catalogue.
  async function listWorkspaces() {
    if (!apiUrl) return [];
    try {
      const res = await fetch(`${apiUrl}/api/workspaces`, { headers: headers() });
      if (!res.ok) return [];
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.workspaces || []);
      return list.map((w) => ({
        id: w.id,
        name: w.name || "",
        visibility: w.visibility === "private" ? "private" : "shared",
        ownerUid: w.ownerUid || "",
        ownerEmail: w.ownerEmail || "",
        pageCount: Number(w.pageCount || 0),
        currentPageId: w.currentPageId || null,
        updatedAt: w.updatedAt || "",
        createdAt: w.createdAt || "",
      })).filter((w) => w.id);
    } catch { return []; }
  }

  // Delete from the Firebase-backed server catalogue as well as the browser.
  // Without this, workspace discovery adds a locally-deleted workspace back on
  // the next sign-in/reload because the remote copy still exists.
  async function deleteWorkspace(id) {
    if (!apiUrl || !id) throw new Error("Workspace API is unavailable.");
    const res = await fetch(`${apiUrl}/api/workspaces/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Workspace deletion failed (${res.status}).`);
    }
    lastPushedJson.delete(id);
    lastPulledAt.delete(id);
    return true;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.WorkspaceApiBridge = {
    apiUrl,
    setApiToken,
    pushNow:        pushAll,
    pullWorkspace,
    pushWorkspace,
    listWorkspaces,
    deleteWorkspace,
  };
})();
