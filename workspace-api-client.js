(function () {
  const params = new URLSearchParams(window.location.search);
  const apiUrl = (params.get("api") || window.WORKSPACE_API_URL || "").replace(/\/$/, "");
  const apiToken = params.get("apiToken") || window.WORKSPACE_API_TOKEN || "";
  if (!apiUrl) return;

  const DATA_PREFIX = "workspace_v4_data_";
  const WORKSPACES_KEY = "workspace_v4_workspaces";
  const ACTIVE_KEY = "workspace_v4_active_workspace";
  const syncedJsonByWorkspace = new Map();
  let syncTimer = null;

  const headers = () => {
    const next = { "content-type": "application/json" };
    if (apiToken) next.authorization = `Bearer ${apiToken}`;
    return next;
  };

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const workspaceMeta = (workspaceId) => {
    const workspaces = readJson(WORKSPACES_KEY, []);
    return (workspaces || []).find((workspace) => workspace.id === workspaceId) || {};
  };

  async function pushWorkspace(workspaceId) {
    if (!workspaceId) return null;
    const key = `${DATA_PREFIX}${workspaceId}`;
    const raw = localStorage.getItem(key);
    if (!raw || syncedJsonByWorkspace.get(workspaceId) === raw) return null;
    const meta = workspaceMeta(workspaceId);
    const response = await fetch(`${apiUrl}/api/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        id: workspaceId,
        name: meta.name || workspaceId,
        source: "browser-localStorage",
        data: JSON.parse(raw),
      }),
    });
    if (!response.ok) throw new Error(`Workspace API sync failed: ${response.status}`);
    syncedJsonByWorkspace.set(workspaceId, raw);
    return response.json();
  }

  async function syncAll() {
    const ids = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_PREFIX)) ids.push(key.slice(DATA_PREFIX.length));
    }
    for (const id of ids) {
      try {
        await pushWorkspace(id);
      } catch (error) {
        console.warn(error.message);
      }
    }
  }

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncAll, 600);
  }

  try {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      originalSetItem(key, value);
      if (key === ACTIVE_KEY || key === WORKSPACES_KEY || key.startsWith(DATA_PREFIX)) scheduleSync();
    };
  } catch {
    setInterval(syncAll, 5000);
  }

  window.WorkspaceApiBridge = {
    syncNow: syncAll,
    pushWorkspace,
    apiUrl,
  };

  window.addEventListener("load", () => setTimeout(syncAll, 1000));
})();
