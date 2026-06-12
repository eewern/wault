// Two-way sync bridge between the browser workspace and the local API server.
// Push: whenever workspace data changes in localStorage → PUT to API server.
// Pull: every 8 s poll the API server; if an external tool (e.g. Claude) wrote
//       newer data, fire a CustomEvent so the React app can apply the update.
(function () {
  const params  = new URLSearchParams(window.location.search);
  const apiUrl  = (params.get("api") || window.WORKSPACE_API_URL || "").replace(/\/$/, "");
  const apiToken = params.get("apiToken") || window.WORKSPACE_API_TOKEN || "";
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

  // ── Hook localStorage.setItem to detect saves ──────────────────────────────
  try {
    const origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      origSet(key, value);
      if (key === ACTIVE_KEY || key === WORKSPACES_KEY || key.startsWith(DATA_PREFIX)) schedulePush();
    };
  } catch {
    setInterval(pushAll, 5000);
  }

  // ── Start polling ──────────────────────────────────────────────────────────
  window.addEventListener("load", () => {
    setTimeout(pushAll, 1200);          // initial push after app boot
    setInterval(pollActive, POLL_INTERVAL_MS);
  });

  // ── Public API ─────────────────────────────────────────────────────────────
  window.WorkspaceApiBridge = {
    apiUrl,
    pushNow:        pushAll,
    pullWorkspace,
    pushWorkspace,
  };
})();
