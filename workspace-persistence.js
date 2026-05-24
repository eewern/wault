(function () {
  const config = window.SUPABASE_CONFIG || {};
  const hasConfig = Boolean(config.url && config.anonKey && window.supabase);

  let client = null;
  let workspaceId = null;
  let currentUser = null;
  let saving = false;
  let pendingData = null;
  let lastSavedJson = "";
  let lastSavedData = null;
  let lastRemoteUpdatedAt = null;
  let inFlightSaveJson = "";
  let realtimeChannel = null;
  let presenceChannel = null;
  let currentPresence = {};
  let backupTimer = null;
  let seedWorkspaces = [];
  let listeners = { onState: () => {}, onData: () => {}, onPresence: () => {} };

  const setState = (patch) => listeners.onState(patch);
  const clone = (value) => JSON.parse(JSON.stringify(value || {}));
  const sameJson = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
  const changedFromBase = (base, value) => !sameJson(base, value);
  const byId = (items = []) => items.reduce((acc, item) => {
    if (item?.id) acc[item.id] = item;
    return acc;
  }, {});

  function mergeBlockArrays(baseBlocks = [], localBlocks = [], remoteBlocks = []) {
    const baseMap = byId(baseBlocks);
    const localMap = byId(localBlocks);
    const remoteMap = byId(remoteBlocks);
    const order = [];
    [...remoteBlocks, ...localBlocks, ...baseBlocks].forEach((block) => {
      if (block?.id && !order.includes(block.id)) order.push(block.id);
    });

    return order.map((id) => {
      const base = baseMap[id];
      const local = localMap[id];
      const remote = remoteMap[id];
      if (!local && remote && changedFromBase(base, remote)) return remote;
      if (!remote && local && changedFromBase(base, local)) return local;
      if (!local) return remote;
      if (!remote) return local;
      const localChanged = changedFromBase(base, local);
      const remoteChanged = changedFromBase(base, remote);
      if (localChanged && !remoteChanged) return local;
      if (!localChanged && remoteChanged) return remote;
      if (localChanged && remoteChanged && !sameJson(local, remote)) {
        return { ...remote, _conflictBackup: local, _conflictAt: new Date().toISOString(), _conflictBy: currentUser?.email || currentUser?.id || "local" };
      }
      return localChanged ? local : remote;
    }).filter(Boolean);
  }

  function mergeWorkspaceData(baseData, localData, remoteData) {
    const base = clone(baseData);
    const local = clone(localData);
    const remote = clone(remoteData);
    const merged = { ...remote, ...local };
    const pageIds = new Set([
      ...Object.keys(base.pages || {}),
      ...Object.keys(remote.pages || {}),
      ...Object.keys(local.pages || {}),
    ]);
    merged.pages = {};

    pageIds.forEach((id) => {
      const basePage = base.pages?.[id];
      const localPage = local.pages?.[id];
      const remotePage = remote.pages?.[id];
      if (!localPage && remotePage && changedFromBase(basePage, remotePage)) {
        merged.pages[id] = remotePage;
        return;
      }
      if (!remotePage && localPage && changedFromBase(basePage, localPage)) {
        merged.pages[id] = localPage;
        return;
      }
      if (!localPage) {
        if (remotePage) merged.pages[id] = remotePage;
        return;
      }
      if (!remotePage) {
        merged.pages[id] = localPage;
        return;
      }
      const localChanged = changedFromBase(basePage, localPage);
      const remoteChanged = changedFromBase(basePage, remotePage);
      const page = localChanged && !remoteChanged ? localPage : remoteChanged && !localChanged ? remotePage : { ...remotePage, ...localPage };
      page.blocks = mergeBlockArrays(basePage?.blocks || [], localPage.blocks || [], remotePage.blocks || []);
      merged.pages[id] = page;
    });

    merged.rootOrder = local.rootOrder || remote.rootOrder || [];
    merged.childOrder = { ...(remote.childOrder || {}), ...(local.childOrder || {}) };
    merged.currentPageId = local.currentPageId || remote.currentPageId;
    return merged;
  }

  async function createBackupSnapshot(kind, data) {
    if (!client || !workspaceId || !currentUser || !data?.pages) return;
    try {
      await client.from("workspace_backups").insert({
        workspace_id: workspaceId,
        created_by: currentUser.id,
        reason: kind,
        data,
      });
      setState({ backupStatus: `Backup saved ${new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}` });
    } catch (error) {
      setState({ backupStatus: "Backup failed", error: error.message });
    }
  }

  function scheduleRemoteBackup(data) {
    if (backupTimer) clearTimeout(backupTimer);
    backupTimer = setTimeout(() => createBackupSnapshot("autosave", data), 1200);
  }

  function startRealtime(defaultData) {
    if (!client || !workspaceId) return;
    if (realtimeChannel) client.removeChannel(realtimeChannel);
    realtimeChannel = client
      .channel(`workspace:${workspaceId}`)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"notion_workspaces", filter:`id=eq.${workspaceId}` }, (payload) => {
        const remoteData = payload.new?.data || defaultData;
        const remoteJson = JSON.stringify(remoteData);
        if (remoteJson === inFlightSaveJson) {
          lastSavedData = clone(remoteData);
          lastSavedJson = remoteJson;
          lastRemoteUpdatedAt = payload.new?.updated_at || lastRemoteUpdatedAt;
          inFlightSaveJson = "";
          setState({ status: "Synced", error: "" });
          return;
        }
        if (remoteJson === lastSavedJson) return;
        const merged = mergeWorkspaceData(lastSavedData || defaultData, lastSavedData || defaultData, remoteData);
        lastSavedData = clone(merged);
        lastSavedJson = JSON.stringify(merged);
        lastRemoteUpdatedAt = payload.new?.updated_at || lastRemoteUpdatedAt;
        setState({ status: "Live sync received", error: "" });
        listeners.onData(merged);
      })
      .subscribe();
  }

  function parsePresenceState(state) {
    const entries = {};
    Object.entries(state || {}).forEach(([key, presences]) => {
      const latest = Array.isArray(presences) ? presences[presences.length - 1] : presences;
      if (!latest?.editingBlockId) return;
      if (latest.userId === currentUser?.id) return;
      entries[latest.editingBlockId] = {
        userId: latest.userId || key,
        email: latest.email || "Teammate",
        pageId: latest.editingPageId || null,
        at: latest.at || null,
      };
    });
    return entries;
  }

  function emitPresence() {
    currentPresence = presenceChannel ? parsePresenceState(presenceChannel.presenceState()) : {};
    listeners.onPresence(currentPresence);
  }

  function startPresence() {
    if (!client || !workspaceId || !currentUser) return;
    if (presenceChannel) client.removeChannel(presenceChannel);
    presenceChannel = client.channel(`workspace-presence:${workspaceId}`, {
      config: { presence: { key: currentUser.id } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, emitPresence)
      .on("presence", { event: "leave" }, emitPresence)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await presenceChannel.track({
          userId: currentUser.id,
          email: currentUser.email,
          editingBlockId: null,
          editingPageId: null,
          at: new Date().toISOString(),
        });
      });
  }

  function stopPresence() {
    if (presenceChannel && client) client.removeChannel(presenceChannel);
    presenceChannel = null;
    currentPresence = {};
    listeners.onPresence({});
  }

  async function fetchWorkspaceList() {
    const { data: workspaces, error } = await client
      .from("notion_workspaces")
      .select("id,name,seed_key,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    const seedOrder = (seedWorkspaces || []).map((workspace) => workspace.seedKey).filter(Boolean);
    return (workspaces || []).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      seedKey: workspace.seed_key,
      updatedAt: workspace.updated_at,
    })).sort((a, b) => {
      const ai = seedOrder.indexOf(a.seedKey);
      const bi = seedOrder.indexOf(b.seedKey);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
  }

  async function fetchCurrentMemberRole() {
    if (!client || !workspaceId || !currentUser) return null;
    const { data: member } = await client
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", currentUser.id)
      .maybeSingle();
    return member?.role || null;
  }

  async function loadWorkspace(id, defaultData) {
    const { data: ws, error } = await client
      .from("notion_workspaces")
      .select("id,name,data,owner,seed_key,updated_at")
      .eq("id", id)
      .single();

    if (error) throw error;
    workspaceId = ws.id;
    lastSavedData = clone(ws.data || defaultData);
    lastSavedJson = JSON.stringify(lastSavedData);
    lastRemoteUpdatedAt = ws.updated_at;
    startRealtime(defaultData);
    startPresence();
    const workspaces = await fetchWorkspaceList();
    const role = ws.owner === currentUser.id ? "owner" : await fetchCurrentMemberRole();
    setState({ workspaceId, workspaceName: ws.name, workspaces, role, accessDenied: false, status: "Synced" });
    listeners.onData(lastSavedData);
    return { id: ws.id, name: ws.name, data: lastSavedData, workspaces };
  }

  async function ensureRemoteSeedWorkspaces(defaultData) {
    const seeds = seedWorkspaces.length ? seedWorkspaces : [{
      seedKey: "default",
      name: config.workspaceName || "My Workspace",
      data: defaultData,
    }];
    const userEmail = String(currentUser?.email || "").toLowerCase();
    const ownerEmail = String(config.ownerEmail || "").toLowerCase();
    if (ownerEmail && userEmail !== ownerEmail) return;

    let workspaces = await fetchWorkspaceList();
    const seededKeys = new Set(workspaces.map((workspace) => workspace.seedKey).filter(Boolean));

    const unseeded = workspaces.filter((workspace) => !workspace.seedKey);
    if (unseeded.length === 1 && seeds[0]?.seedKey && !seededKeys.has(seeds[0].seedKey)) {
      const primary = seeds[0];
      await client
        .from("notion_workspaces")
        .update({
          name: primary.name || config.workspaceName || "My Workspace",
          seed_key: primary.seedKey,
          data: primary.data || defaultData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", unseeded[0].id);
      seededKeys.add(primary.seedKey);
      workspaces = await fetchWorkspaceList();
    }

    for (const seed of seeds) {
      if (!seed?.seedKey || seededKeys.has(seed.seedKey)) continue;
      const { data: created, error: createError } = await client
        .from("notion_workspaces")
        .insert({
          name: seed.name || "My Workspace",
          owner: currentUser.id,
          seed_key: seed.seedKey,
          data: seed.data || defaultData,
        })
        .select("id")
        .single();
      if (createError) throw createError;
      const { error: memberError } = await client
        .from("workspace_members")
        .insert({ workspace_id: created.id, user_id: currentUser.id, role: "owner" });
      if (memberError) throw memberError;
      seededKeys.add(seed.seedKey);
      await createBackupSnapshot("workspace-created", seed.data || defaultData);
    }
  }

  async function ensureWorkspace(defaultData) {
    try { await client.rpc("accept_workspace_invites_for_current_user"); } catch (_) {}
    await ensureRemoteSeedWorkspaces(defaultData);
    const workspaces = await fetchWorkspaceList();
    if (workspaces && workspaces.length) {
      const activeId = workspaceId && workspaces.some((workspace) => workspace.id === workspaceId)
        ? workspaceId
        : workspaces[0].id;
      await loadWorkspace(activeId, defaultData);
      return;
    }

    const userEmail = String(currentUser?.email || "").toLowerCase();
    const ownerEmail = String(config.ownerEmail || "").toLowerCase();
    if (ownerEmail && userEmail !== ownerEmail) {
      workspaceId = null;
      lastSavedData = null;
      lastSavedJson = "";
      lastRemoteUpdatedAt = null;
      stopPresence();
      setState({
        user: currentUser,
        workspaceId: null,
        workspaceName: "",
        workspaces: [],
        role: null,
        accessDenied: true,
        status: "Access denied",
        error: "This email has not been invited to the team workspace.",
      });
      return;
    }

    const { data: created, error: createError } = await client
      .from("notion_workspaces")
      .insert({
        name: config.workspaceName || "My Workspace",
        owner: currentUser.id,
        seed_key: seedWorkspaces[0]?.seedKey || "default",
        data: defaultData,
      })
      .select("id,name,data,seed_key,updated_at")
      .single();
    if (createError) throw createError;

    const { error: memberError } = await client
      .from("workspace_members")
      .insert({ workspace_id: created.id, user_id: currentUser.id, role: "owner" });
    if (memberError) throw memberError;

    workspaceId = created.id;
    lastSavedData = clone(defaultData);
    lastSavedJson = JSON.stringify(defaultData);
    lastRemoteUpdatedAt = created.updated_at || null;
    startRealtime(defaultData);
    startPresence();
    await createBackupSnapshot("workspace-created", defaultData);
    setState({
      workspaceId,
      workspaceName: created.name,
      workspaces: [{ id: created.id, name: created.name, updatedAt: new Date().toISOString() }],
      role: "owner",
      accessDenied: false,
      status: "Synced",
    });
    listeners.onData(defaultData);
  }

  async function loadSession(defaultData) {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;

    if (!currentUser) {
      workspaceId = null;
      stopPresence();
      setState({ user: null, workspaceId: null, status: "Sign in to sync" });
      return;
    }

      setState({ user: currentUser, accessDenied: false, status: "Loading workspace" });
    await ensureWorkspace(defaultData);
  }

  window.WorkspaceStore = {
    isConfigured() {
      return hasConfig;
    },

    async init({ defaultData, defaultWorkspaces, onState, onData, onPresence }) {
      seedWorkspaces = Array.isArray(defaultWorkspaces) ? defaultWorkspaces : [];
      listeners = { onState, onData, onPresence: onPresence || (() => {}) };
      if (!hasConfig) {
        setState({ mode: "local", status: "Local draft" });
        return;
      }

      client = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      });

      client.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        if (!currentUser) {
          workspaceId = null;
          stopPresence();
          setState({ user: null, workspaceId: null, role: null, accessDenied: false, status: "Sign in to sync" });
          return;
        }
        setState({ user: currentUser, accessDenied: false, status: "Loading workspace" });
        ensureWorkspace(defaultData).catch((error) => {
          setState({ error: error.message, status: "Sync failed" });
        });
      });

      await loadSession(defaultData);
    },

    canSave() {
      return Boolean(client && currentUser && workspaceId);
    },

    async save(data) {
      if (!this.canSave()) return;
      if (saving) {
        pendingData = data;
        return;
      }
      const json = JSON.stringify(data);
      if (json === lastSavedJson) return;

      saving = true;
      setState({ status: "Saving" });
      let dataToSave = data;
      const { data: latest, error: latestError } = await client
        .from("notion_workspaces")
        .select("data,updated_at")
        .eq("id", workspaceId)
        .single();
      if (latestError) {
        saving = false;
        setState({ error: latestError.message, status: "Sync failed" });
        throw latestError;
      }
      if (latest?.updated_at && lastRemoteUpdatedAt && latest.updated_at !== lastRemoteUpdatedAt) {
        dataToSave = mergeWorkspaceData(lastSavedData, data, latest.data);
        setState({ status: "Merged teammate edits" });
        listeners.onData(dataToSave);
      }
      inFlightSaveJson = JSON.stringify(dataToSave);
      const { error } = await client
        .from("notion_workspaces")
        .update({ data: dataToSave, updated_at: new Date().toISOString() })
        .eq("id", workspaceId);
      saving = false;

      if (error) {
        inFlightSaveJson = "";
        setState({ error: error.message, status: "Sync failed" });
        throw error;
      }
      lastSavedData = clone(dataToSave);
      lastSavedJson = JSON.stringify(dataToSave);
      const { data: savedRow } = await client.from("notion_workspaces").select("updated_at").eq("id", workspaceId).single();
      lastRemoteUpdatedAt = savedRow?.updated_at || lastRemoteUpdatedAt;
      scheduleRemoteBackup(dataToSave);
      setState({ error: "", status: "Synced" });
      if (pendingData) {
        const next = pendingData;
        pendingData = null;
        if (JSON.stringify(next) !== lastSavedJson) await this.save(next);
      }
    },

    async signIn(email) {
      if (!client) throw new Error("Supabase is not configured.");
      const redirectTo = window.location.href.split("#")[0];
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
    },

    async setEditingBlock(pageId, blockId) {
      if (!presenceChannel || !currentUser) return;
      await presenceChannel.track({
        userId: currentUser.id,
        email: currentUser.email,
        editingBlockId: blockId || null,
        editingPageId: pageId || null,
        at: new Date().toISOString(),
      });
    },

    clearEditingBlock() {
      return this.setEditingBlock(null, null);
    },

    async signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async inviteMember(email, role = "editor") {
      if (!client || !workspaceId) throw new Error("Sign in before inviting teammates.");
      const { error } = await client.rpc("invite_workspace_member_by_email", {
        target_workspace_id: workspaceId,
        target_email: email,
        target_role: role,
      });
      if (error) throw error;
    },

    async createWorkspace(name, defaultData) {
      if (!client || !currentUser) throw new Error("Sign in before creating a team workspace.");
      const { data: created, error: createError } = await client
        .from("notion_workspaces")
        .insert({
          name,
          owner: currentUser.id,
          seed_key: null,
          data: defaultData,
      })
        .select("id,name,data,updated_at")
        .single();
      if (createError) throw createError;

      const { error: memberError } = await client
        .from("workspace_members")
        .insert({ workspace_id: created.id, user_id: currentUser.id, role: "owner" });
      if (memberError) throw memberError;

      workspaceId = created.id;
      lastSavedData = clone(created.data || defaultData);
      lastSavedJson = JSON.stringify(lastSavedData);
      lastRemoteUpdatedAt = created.updated_at || null;
      startRealtime(defaultData);
      startPresence();
      await createBackupSnapshot("workspace-created", lastSavedData);
      const workspaces = await fetchWorkspaceList();
      setState({ workspaceId, workspaceName: created.name, workspaces, role: "owner", accessDenied: false, status: "Synced" });
      listeners.onData(created.data || defaultData);
      return { id: created.id, name: created.name, data: created.data || defaultData, workspaces };
    },

    async switchWorkspace(id) {
      if (!client || !currentUser) throw new Error("Sign in before switching workspaces.");
      return loadWorkspace(id, {});
    },

    async renameWorkspace(id, name) {
      if (!client || !currentUser) throw new Error("Sign in before renaming a workspace.");
      const { data: renamed, error } = await client
        .from("notion_workspaces")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id,name")
        .single();
      if (error) throw error;
      const workspaces = await fetchWorkspaceList();
      if (id === workspaceId) setState({ workspaceId: id, workspaceName: renamed.name, workspaces, status: "Synced" });
      else setState({ workspaces, status: "Synced" });
      return { id: renamed.id, name: renamed.name, workspaces };
    },

    async deleteWorkspace(id) {
      if (!client || !currentUser) throw new Error("Sign in before deleting a workspace.");
      const workspacesBefore = await fetchWorkspaceList();
      if ((workspacesBefore || []).length <= 1) throw new Error("Create another workspace before deleting this one.");
      const fallback = (workspacesBefore || []).find((workspace) => workspace.id !== id);
      if (!fallback) throw new Error("No fallback workspace available.");

      const { error: memberError } = await client
        .from("workspace_members")
        .delete()
        .eq("workspace_id", id);
      if (memberError) throw memberError;

      const { error: deleteError } = await client
        .from("notion_workspaces")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;

      if (id === workspaceId) {
        const loaded = await loadWorkspace(fallback.id, {});
        return loaded;
      }
      const workspaces = await fetchWorkspaceList();
      setState({ workspaces, status: "Synced" });
      return { id: workspaceId, name: workspaces.find((workspace) => workspace.id === workspaceId)?.name || "", data: lastSavedData, workspaces };
    },
  };
})();
