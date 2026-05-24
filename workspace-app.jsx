// === Main workspace app ===
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const STORAGE_KEY = "workspace_v4_dark";
const LOCAL_WORKSPACES_KEY = "workspace_v4_workspaces";
const LOCAL_ACTIVE_WORKSPACE_KEY = "workspace_v4_active_workspace";
const DEFAULT_LOCAL_WORKSPACE_ID = "local_default";
const TASK_INDEX_PAGE_ID = "task_index";
const LOCAL_BACKUP_INTERVAL_MS = 60000;
const LOCAL_BACKUP_LIMIT = 30;
const SEED_REFRESH_VERSION = "20260515-stable-edits2";

const cloneDefaultWorkspace = () => JSON.parse(JSON.stringify(window.WORKSPACE_DEFAULT));
const workspaceSeeds = () => (
  Array.isArray(window.WORKSPACE_SEEDS) && window.WORKSPACE_SEEDS.length
    ? window.WORKSPACE_SEEDS
    : [{ id: DEFAULT_LOCAL_WORKSPACE_ID, seedKey: "default", name: "My Workspace", data: window.WORKSPACE_DEFAULT }]
);
const cloneWorkspaceData = (data) => JSON.parse(JSON.stringify(data || window.WORKSPACE_DEFAULT));
const createTextBlock = () => ({ id: window.nid(), type:"text", text:"" });
const createEmptyWorkspace = () => normalizeWorkspaceData({
  pages: {
    home: {
      id: "home",
      parentId: null,
      title: "Untitled",
      icon: randomPageIcon(),
      date: "",
      blocks: [createTextBlock()],
    },
  },
  rootOrder: ["home"],
  childOrder: {},
  currentPageId: "home",
});
const isBlankTextBlock = (block) => {
  if (!block || block.type !== "text") return false;
  const text = window.stripHtml ? window.stripHtml(block.text || "") : String(block.text || "").replace(/<[^>]*>/g, "");
  return text.replace(/\u200B/g, "").trim() === "";
};
const ensureTrailingTextBlock = (blocks = []) => {
  const next = Array.isArray(blocks) ? [...blocks] : [];
  while (next.length > 1 && isBlankTextBlock(next[next.length - 1]) && isBlankTextBlock(next[next.length - 2])) {
    next.pop();
  }
  if (next.length === 0 || !isBlankTextBlock(next[next.length - 1])) next.push(createTextBlock());
  return next;
};
const localWorkspaceDataKey = (id) => `workspace_v4_data_${id}`;
const createWorkspaceId = () => `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const PAGE_EMOJIS = ["📄", "📝", "💡", "📌", "🗂️", "📊", "🧭", "🚀", "✨", "🔖", "🧠", "🛠️"];
const randomPageIcon = () => PAGE_EMOJIS[Math.floor(Math.random() * PAGE_EMOJIS.length)];
const formatWorkspaceDate = (date = new Date()) => {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = localDate.getDay() || 7;
  localDate.setDate(localDate.getDate() + 4 - day);
  const yearStart = new Date(localDate.getFullYear(), 0, 1);
  const week = Math.ceil((((localDate - yearStart) / 86400000) + 1) / 7);
  return {
    weekLabel: `Week ${String(week).padStart(2, "0")} of ${localDate.getFullYear()}`,
    dateLabel: date.toLocaleDateString([], { weekday:"short", day:"numeric", month:"short", year:"numeric" }),
  };
};
const RETIRED_CHURNS_WEEK_1_DAY_PAGE_IDS = [
  "churns_week_1_sun_17",
  "churns_week_1_mon_18",
  "churns_week_1_tue_19",
  "churns_week_1_wed_20",
  "churns_week_1_thu_21",
  "churns_week_1_fri_22",
  "churns_week_1_sat_23",
  "churns_week_1_sun_24",
];
const RETIRED_CHURNS_WEEK_1_DAY_PAGE_SET = new Set(RETIRED_CHURNS_WEEK_1_DAY_PAGE_IDS);
const taskIndexPage = () => ({
  id: TASK_INDEX_PAGE_ID,
  parentId: null,
  title: "Tasks by Due Date",
  icon: "✅",
  blocks: [],
  system: true,
});
const mergeOrderedIds = (existing = [], official = [], keep = () => true) => {
  const officialSet = new Set(official);
  const next = existing.filter((id) => officialSet.has(id) || keep(id));
  official.forEach((id) => {
    if (!next.includes(id)) next.push(id);
  });
  return [...new Set(next)];
};
const cleanupRetiredChurnsWeek1DayPages = (data) => {
  if (!data || !data.pages) return data;
  RETIRED_CHURNS_WEEK_1_DAY_PAGE_IDS.forEach((id) => {
    delete data.pages[id];
  });
  data.rootOrder = (data.rootOrder || []).filter((id) => !RETIRED_CHURNS_WEEK_1_DAY_PAGE_SET.has(id));
  const childOrder = data.childOrder || {};
  Object.keys(childOrder).forEach((parentId) => {
    childOrder[parentId] = (childOrder[parentId] || []).filter((id) => !RETIRED_CHURNS_WEEK_1_DAY_PAGE_SET.has(id));
  });
  data.childOrder = childOrder;
  if (RETIRED_CHURNS_WEEK_1_DAY_PAGE_SET.has(data.currentPageId)) {
    data.currentPageId = "churns_60_day_week_1";
  }
  return data;
};

function normalizeWorkspaceData(raw) {
  const data = raw && raw.pages ? raw : cloneDefaultWorkspace();
  const pages = { ...data.pages };
  let rootOrder = [...(data.rootOrder || [])];
  const shouldRefreshSeedContent = data.seedRefreshVersion !== SEED_REFRESH_VERSION;

  if (!pages[TASK_INDEX_PAGE_ID]) {
    pages[TASK_INDEX_PAGE_ID] = taskIndexPage();
  } else {
    pages[TASK_INDEX_PAGE_ID] = { ...pages[TASK_INDEX_PAGE_ID], title: "Tasks by Due Date", icon: "✅", parentId: null, system: true, blocks: [] };
  }
  if (!rootOrder.includes(TASK_INDEX_PAGE_ID)) {
    const insertAt = rootOrder.includes("home") ? rootOrder.indexOf("home") + 1 : rootOrder.length;
    rootOrder.splice(insertAt, 0, TASK_INDEX_PAGE_ID);
  }

  if (pages.churns_home && !pages.churns_content_intelligence && window.CHURNS_CONTENT_INTELLIGENCE_PAGE) {
    pages.churns_content_intelligence = cloneWorkspaceData(window.CHURNS_CONTENT_INTELLIGENCE_PAGE);
    pages.churns_content_intelligence.parentId = null;
    const insertAfter = rootOrder.includes("churns_content_funnel")
      ? rootOrder.indexOf("churns_content_funnel") + 1
      : rootOrder.length;
    rootOrder.splice(insertAfter, 0, "churns_content_intelligence");
  }

  if (pages.churns_home && window.CHURNS_60_DAY_CONTENT_PAGES) {
    const contentPages = cloneWorkspaceData(window.CHURNS_60_DAY_CONTENT_PAGES);
    const contentParent = contentPages.find((page) => page.id === "churns_60_day_content");
    if (shouldRefreshSeedContent && contentParent && pages.churns_60_day_content) {
      pages.churns_60_day_content = contentParent;
    }
    const missingPages = contentPages.filter((page) => !pages[page.id]);
    if (missingPages.length) {
      missingPages.forEach((page) => {
        pages[page.id] = page;
      });
      if (!rootOrder.includes("churns_60_day_content")) {
        const insertAfter = rootOrder.includes("churns_content_intelligence")
          ? rootOrder.indexOf("churns_content_intelligence") + 1
          : rootOrder.length;
        rootOrder.splice(insertAfter, 0, "churns_60_day_content");
      }
    }
  }

  const childOrder = { ...(data.childOrder || {}) };
  cleanupRetiredChurnsWeek1DayPages({ pages, rootOrder, childOrder, currentPageId: data.currentPageId });

  if (pages.churns_60_day_content && window.CHURNS_60_DAY_CONTENT_PAGES) {
    const weekIds = window.CHURNS_60_DAY_CONTENT_PAGES
      .filter((page) => page.parentId === "churns_60_day_content")
      .map((page) => page.id)
      .filter((id) => pages[id]);
    const existingChildren = childOrder.churns_60_day_content || [];
    const customChildren = existingChildren.filter((id) => !weekIds.includes(id) && pages[id]?.parentId === "churns_60_day_content");
    const discoveredChildren = Object.values(pages)
      .filter((page) => page.parentId === "churns_60_day_content")
      .map((page) => page.id)
      .filter((id) => !weekIds.includes(id) && !customChildren.includes(id));
    childOrder.churns_60_day_content = mergeOrderedIds(
      existingChildren,
      weekIds,
      (id) => pages[id]?.parentId === "churns_60_day_content"
    );
    discoveredChildren.forEach((id) => {
      if (!childOrder.churns_60_day_content.includes(id)) childOrder.churns_60_day_content.push(id);
    });
    rootOrder = rootOrder.filter((id) => !childOrder.churns_60_day_content.includes(id));
  }

  if (pages.churns_60_day_content && window.CHURNS_WEEK_1_FOUNDER_CONTENT_PAGES) {
    cleanupRetiredChurnsWeek1DayPages({ pages, rootOrder, childOrder, currentPageId: data.currentPageId });
    const week1Pages = cloneWorkspaceData(window.CHURNS_WEEK_1_FOUNDER_CONTENT_PAGES);
    const officialIds = week1Pages.map((page) => page.id);
    week1Pages.forEach((page) => {
      if (shouldRefreshSeedContent || !pages[page.id]) pages[page.id] = page;
    });
    if (!pages.churns_60_day_content) {
      pages.churns_60_day_content = week1Pages[0];
    }
    if (!childOrder.churns_60_day_content?.includes("churns_60_day_week_1")) {
      childOrder.churns_60_day_content = ["churns_60_day_week_1", ...(childOrder.churns_60_day_content || [])];
    }
    childOrder.churns_60_day_content = [...new Set(childOrder.churns_60_day_content)];
    const officialWeek1Children = week1Pages
      .filter((page) => page.parentId === "churns_60_day_week_1")
      .map((page) => page.id);
    const existingWeek1Children = childOrder.churns_60_day_week_1 || [];
    const customWeek1Children = existingWeek1Children.filter((id) => !officialIds.includes(id) && pages[id]?.parentId === "churns_60_day_week_1");
    const discoveredWeek1Children = Object.values(pages)
      .filter((page) => page.parentId === "churns_60_day_week_1")
      .map((page) => page.id)
      .filter((id) => !officialWeek1Children.includes(id) && !customWeek1Children.includes(id));
    childOrder.churns_60_day_week_1 = mergeOrderedIds(
      existingWeek1Children,
      officialWeek1Children,
      (id) => pages[id]?.parentId === "churns_60_day_week_1"
    );
    discoveredWeek1Children.forEach((id) => {
      if (!childOrder.churns_60_day_week_1.includes(id)) childOrder.churns_60_day_week_1.push(id);
    });
    rootOrder = rootOrder.filter((id) => !officialIds.includes(id));

    cleanupRetiredChurnsWeek1DayPages({ pages, rootOrder, childOrder, currentPageId: data.currentPageId });
  }

  if (pages.xalt_home && window.XALT_WEEK_1_SCRIPT_PAGES) {
    const scriptPages = cloneWorkspaceData(window.XALT_WEEK_1_SCRIPT_PAGES);
    const hadMissingBefore = scriptPages.some((page) => !pages[page.id]);
    // Refresh existing script pages on version bump (preserves user title/icon)
    scriptPages.forEach((page) => {
      if (shouldRefreshSeedContent || !pages[page.id]) {
        const existing = pages[page.id];
        pages[page.id] = existing
          ? { ...page, title: existing.title, icon: existing.icon }
          : page;
      }
    });
    if (hadMissingBefore) {
      if (!rootOrder.includes("xalt_week_1_script")) {
        const insertAfter = rootOrder.includes("xalt_checklist")
          ? rootOrder.indexOf("xalt_checklist") + 1
          : rootOrder.length;
        rootOrder.splice(insertAfter, 0, "xalt_week_1_script");
      }
    }
    const episodeIds = scriptPages
      .filter((page) => page.parentId === "xalt_week_1_script")
      .map((page) => page.id)
      .filter((id) => pages[id]);
    const existingChildren = childOrder.xalt_week_1_script || [];
    const customChildren = existingChildren.filter((id) => !episodeIds.includes(id) && pages[id]?.parentId === "xalt_week_1_script");
    const discoveredChildren = Object.values(pages)
      .filter((page) => page.parentId === "xalt_week_1_script")
      .map((page) => page.id)
      .filter((id) => !episodeIds.includes(id) && !customChildren.includes(id));
    childOrder.xalt_week_1_script = mergeOrderedIds(
      existingChildren,
      episodeIds,
      (id) => pages[id]?.parentId === "xalt_week_1_script"
    );
    discoveredChildren.forEach((id) => {
      if (!childOrder.xalt_week_1_script.includes(id)) childOrder.xalt_week_1_script.push(id);
    });
    rootOrder = rootOrder.filter((id) => !childOrder.xalt_week_1_script.includes(id));
  }

  Object.values(pages).forEach((page) => {
    if (!Array.isArray(page.blocks)) page.blocks = [];
    if (page.system) return;
    if (typeof page.date !== "string") page.date = "";
    page.blocks = ensureTrailingTextBlock(page.blocks);
  });

  const pageIds = Object.keys(pages);
  const currentPageId = pages[data.currentPageId] ? data.currentPageId : (rootOrder.find((id) => pages[id]) || pageIds[0]);

  const normalized = cleanupRetiredChurnsWeek1DayPages({ ...data, pages, rootOrder, childOrder, currentPageId, seedRefreshVersion: SEED_REFRESH_VERSION });
  if (!normalized.pages[normalized.currentPageId]) {
    normalized.currentPageId = normalized.rootOrder.find((id) => normalized.pages[id]) || Object.keys(normalized.pages)[0];
  }
  return normalized;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function migrateRetiredDayPagesInLocalStorage() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key === STORAGE_KEY || key.startsWith("workspace_v4_data_"))) keys.push(key);
    }
    keys.forEach((key) => {
      const stored = readJson(key, null);
      if (!stored?.pages) return;
      const before = JSON.stringify({
        pages: Object.keys(stored.pages || {}),
        rootOrder: stored.rootOrder || [],
        childOrder: stored.childOrder || {},
        currentPageId: stored.currentPageId || null,
      });
      cleanupRetiredChurnsWeek1DayPages(stored);
      const after = JSON.stringify({
        pages: Object.keys(stored.pages || {}),
        rootOrder: stored.rootOrder || [],
        childOrder: stored.childOrder || {},
        currentPageId: stored.currentPageId || null,
      });
      if (before !== after) localStorage.setItem(key, JSON.stringify(stored));
    });
  } catch {}
}

function initializeLocalWorkspaces() {
  migrateRetiredDayPagesInLocalStorage();
  let workspaces = readJson(LOCAL_WORKSPACES_KEY, null);
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    const legacy = readJson(STORAGE_KEY, null);
    const seeds = workspaceSeeds();
    workspaces = seeds.map((seed, index) => ({
      id: seed.id || `${DEFAULT_LOCAL_WORKSPACE_ID}_${index}`,
      seedKey: seed.seedKey || seed.id || `seed_${index}`,
      name: seed.name || "My Workspace",
      updatedAt: new Date().toISOString(),
    }));
    seeds.forEach((seed, index) => {
      const id = seed.id || `${DEFAULT_LOCAL_WORKSPACE_ID}_${index}`;
      const source = index === 0 && legacy ? legacy : cloneWorkspaceData(seed.data);
      localStorage.setItem(localWorkspaceDataKey(id), JSON.stringify(normalizeWorkspaceData(source)));
    });
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(workspaces));
    localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, workspaces[0].id);
  } else {
    const existingIds = new Set(workspaces.map((workspace) => workspace.id));
    const missing = [];
    workspaceSeeds().forEach((seed, index) => {
      const id = seed.id || `${DEFAULT_LOCAL_WORKSPACE_ID}_${index}`;
      if (existingIds.has(id)) return;
      const workspace = {
        id,
        seedKey: seed.seedKey || seed.id || `seed_${index}`,
        name: seed.name || "My Workspace",
        updatedAt: new Date().toISOString(),
      };
      missing.push(workspace);
      localStorage.setItem(localWorkspaceDataKey(id), JSON.stringify(normalizeWorkspaceData(cloneWorkspaceData(seed.data))));
    });
    if (missing.length) {
      workspaces = [...workspaces, ...missing];
      localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(workspaces));
    }
  }

  const activeId = localStorage.getItem(LOCAL_ACTIVE_WORKSPACE_KEY) || workspaces[0].id;
  const safeActiveId = workspaces.some((workspace) => workspace.id === activeId) ? activeId : workspaces[0].id;
  localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, safeActiveId);
  return { workspaces, activeId: safeActiveId };
}

function loadLocalWorkspaceData(workspaceId) {
  const stored = readJson(localWorkspaceDataKey(workspaceId), null);
  if (stored) return normalizeWorkspaceData(stored);
  // Use the workspace-specific seed so churns gets churns data, xalt gets xalt data
  const seed = workspaceSeeds().find(s => s.id === workspaceId || s.seedKey === workspaceId);
  const seedData = seed?.data ? JSON.parse(JSON.stringify(seed.data)) : cloneDefaultWorkspace();
  return normalizeWorkspaceData(seedData);
}

function saveLocalWorkspaceData(workspaceId, data) {
  localStorage.setItem(localWorkspaceDataKey(workspaceId), JSON.stringify(data));
  const workspaces = readJson(LOCAL_WORKSPACES_KEY, []);
  const next = workspaces.map((workspace) => (
    workspace.id === workspaceId ? { ...workspace, updatedAt: new Date().toISOString() } : workspace
  ));
  localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(next));
  localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, workspaceId);
  return next;
}

function localBackupKey(workspaceId) {
  return `workspace_v4_backups_${workspaceId}`;
}

function writeLocalAutoBackup(workspaceId, data, reason = "autosave") {
  if (!workspaceId || !data?.pages) return null;
  const key = localBackupKey(workspaceId);
  const backups = readJson(key, []);
  const now = new Date().toISOString();
  const latest = backups[0];
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < LOCAL_BACKUP_INTERVAL_MS) return latest;
  const snapshot = { id: `backup_${Date.now()}`, reason, createdAt: now, data };
  const next = [snapshot, ...backups].slice(0, LOCAL_BACKUP_LIMIT);
  localStorage.setItem(key, JSON.stringify(next));
  return snapshot;
}

function historyComparable(data) {
  // Exclude title, icon, date from undo tracking — page renames/icon changes
  // are intentional actions and should never be reverted by Ctrl+Z.
  const pages = {};
  Object.entries(data?.pages || {}).forEach(([id, page]) => {
    const { title: _t, icon: _i, date: _d, ...rest } = page;
    pages[id] = rest;
  });
  return JSON.stringify({
    pages,
    rootOrder: data?.rootOrder || [],
    childOrder: data?.childOrder || {},
  });
}

function App() {
  const initialLocal = useMemo(() => initializeLocalWorkspaces(), []);
  const [data, setData] = useState(() => {
    return loadLocalWorkspaceData(initialLocal.activeId);
  });
  const [localWorkspaces, setLocalWorkspaces] = useState(initialLocal.workspaces);
  const [activeLocalWorkspaceId, setActiveLocalWorkspaceId] = useState(initialLocal.activeId);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [presenceLocks, setPresenceLocks] = useState({});
  const activeLocalWorkspace = localWorkspaces.find((workspace) => workspace.id === activeLocalWorkspaceId) || localWorkspaces[0];
  const [syncState, setSyncState] = useState(() => ({
    mode: window.WorkspaceStore?.isConfigured() ? "supabase" : "local",
    status: window.WorkspaceStore?.isConfigured() ? "Sign in to sync" : "Local draft",
    user: null,
    workspaceId: initialLocal.activeId,
    workspaceName: activeLocalWorkspace?.name || "My Workspace",
    workspaces: initialLocal.workspaces,
    busy: false,
    error: "",
    backupStatus: "",
    role: null,
    accessDenied: false,
  }));
  const remoteReady = useRef(false);
  const currentPageIdRef = useRef(data.currentPageId);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const historyBaseRef = useRef(data);
  const historyBaseJsonRef = useRef(historyComparable(data));
  const historyTimerRef = useRef(null);
  const historySkipRef = useRef(false);

  const commitHistorySnapshot = useCallback((current) => {
    const nextJson = historyComparable(current);
    if (nextJson === historyBaseJsonRef.current) return false;
    undoStackRef.current = [...undoStackRef.current.slice(-79), historyBaseRef.current];
    redoStackRef.current = [];
    historyBaseRef.current = current;
    historyBaseJsonRef.current = nextJson;
    return true;
  }, []);

  const performUndo = useCallback(() => {
    setData((current) => {
      commitHistorySnapshot(current);
      const previous = undoStackRef.current.pop();
      if (!previous) return current;
      redoStackRef.current.push(current);
      historySkipRef.current = true;
      historyBaseRef.current = previous;
      historyBaseJsonRef.current = historyComparable(previous);
      return previous;
    });
  }, [commitHistorySnapshot]);

  const performRedo = useCallback(() => {
    setData((current) => {
      const next = redoStackRef.current.pop();
      if (!next) return current;
      undoStackRef.current.push(current);
      historySkipRef.current = true;
      historyBaseRef.current = next;
      historyBaseJsonRef.current = historyComparable(next);
      return next;
    });
  }, []);

  useEffect(() => {
    currentPageIdRef.current = data.currentPageId;
  }, [data.currentPageId]);

  // Initialize cross-tab localStorage sync
  useEffect(() => {
    if (!window.WorkspaceLocalStorage) return;

    // When another tab changes the data, update this tab
    window.WorkspaceLocalStorage.init((syncedData) => {
      if (!syncedData) return;
      console.log('📡 Received data from another tab, syncing...');
      setData(current => {
        // Only update if the synced data is actually different
        if (JSON.stringify(syncedData) !== JSON.stringify(current)) {
          return normalizeWorkspaceData(syncedData);
        }
        return current;
      });
    });
  }, []);

  const historyForceCommitRef = useRef(false);

  useEffect(() => {
    if (historySkipRef.current) {
      historySkipRef.current = false;
      return;
    }
    if (historyForceCommitRef.current) {
      historyForceCommitRef.current = false;
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      commitHistorySnapshot(data);
      return;
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => commitHistorySnapshot(data), 220);
    return () => clearTimeout(historyTimerRef.current);
  }, [data, commitHistorySnapshot]);

  // Call this at word boundaries (space, enter, punctuation) to create a fine-grained undo step
  const forceHistoryCommit = useCallback(() => {
    historyForceCommitRef.current = true;
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        performRedo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [performUndo, performRedo]);

  useEffect(() => {
    let active = true;
    const store = window.WorkspaceStore;
    if (!store?.isConfigured()) return;

    store.init({
      defaultData: cloneDefaultWorkspace(),
      defaultWorkspaces: workspaceSeeds().map((seed) => ({
        seedKey: seed.seedKey || seed.id,
        name: seed.name,
        data: normalizeWorkspaceData(cloneWorkspaceData(seed.data)),
      })),
      onState: (patch) => active && setSyncState((s) => ({ ...s, ...patch, mode: "supabase" })),
      onData: (remoteData) => {
        if (!active || !remoteData?.pages) return;
        remoteReady.current = true;
        setData((current) => {
          const next = normalizeWorkspaceData(remoteData);
          const localCurrentPageId = currentPageIdRef.current || current.currentPageId;
          if (localCurrentPageId && next.pages?.[localCurrentPageId]) {
            next.currentPageId = localCurrentPageId;
            const activeElement = document.activeElement;
            if (activeElement?.closest?.(`[data-block-id]`) || activeElement?.isContentEditable) {
              next.pages[localCurrentPageId] = current.pages[localCurrentPageId] || next.pages[localCurrentPageId];
            }
          }
          return next;
        });
      },
      onPresence: (presence) => active && setPresenceLocks(presence || {}),
    }).catch((error) => {
      setSyncState((s) => ({ ...s, error: error.message, status: "Sync setup failed" }));
    });

    return () => { active = false; };
  }, []);

  // Debounced local + remote save
  const saveTimer = useRef(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        const backup = writeLocalAutoBackup(activeLocalWorkspaceId, data);
        if (backup) setSyncState((s) => ({ ...s, backupStatus: `Local backup ${new Date(backup.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}` }));
        if (!window.WorkspaceStore?.canSave()) {
          const nextWorkspaces = saveLocalWorkspaceData(activeLocalWorkspaceId, data);
          setLocalWorkspaces(nextWorkspaces);
        }
      } catch {}
      if (window.WorkspaceStore?.canSave() && remoteReady.current) {
        window.WorkspaceStore.save(data).catch((error) => {
          setSyncState((s) => ({ ...s, error: error.message, status: "Sync failed" }));
        });
      }
    }, 200);
    return () => clearTimeout(saveTimer.current);
  }, [data, activeLocalWorkspaceId]);

  const currentPage = data.pages[data.currentPageId];

  // === Page operations ===
  const setCurrentPage = (id) => setData(d => ({ ...d, currentPageId: id }));

  const updatePage = (id, patch) => setData(d => {
    const current = d.pages[id];
    const nextPage = { ...current, ...patch };
    if (current && !current.system && Object.prototype.hasOwnProperty.call(patch, "blocks")) {
      nextPage.blocks = ensureTrailingTextBlock(patch.blocks);
    }
    return { ...d, pages: { ...d.pages, [id]: nextPage } };
  });

  const addPage = (parentId = null) => {
    const id = "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    const newPage = {
      id, parentId,
      title: "Untitled",
      icon: randomPageIcon(),
      date: "",
      blocks: [createTextBlock()],
    };
    setData(d => {
      const next = { ...d, pages: { ...d.pages, [id]: newPage }, currentPageId: id };
      if (parentId) {
        next.childOrder = { ...d.childOrder, [parentId]: [...(d.childOrder[parentId] || []), id] };
      } else {
        next.rootOrder = [...d.rootOrder, id];
      }
      return next;
    });
  };

  const duplicatePage = (id) => {
    setData((d) => {
      const source = d.pages[id];
      if (!source || source.system) return d;
      const idMap = new Map();
      const collect = (pageId, acc = []) => {
        const page = d.pages[pageId];
        if (!page) return acc;
        acc.push(pageId);
        (d.childOrder?.[pageId] || [])
          .filter((childId) => d.pages[childId])
          .forEach((childId) => collect(childId, acc));
        return acc;
      };
      const sourceIds = collect(id);
      sourceIds.forEach((pageId) => {
        idMap.set(pageId, `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
      });
      const newPages = { ...d.pages };
      const newChildOrder = { ...(d.childOrder || {}) };
      sourceIds.forEach((pageId) => {
        const page = d.pages[pageId];
        const newId = idMap.get(pageId);
        const parentId = pageId === id ? page.parentId : idMap.get(page.parentId);
        newPages[newId] = {
          ...cloneWorkspaceData(page),
          id: newId,
          parentId: parentId || null,
          title: pageId === id ? `${window.stripHtml ? window.stripHtml(page.title) : page.title} copy` : page.title,
        };
        const mappedChildren = (d.childOrder?.[pageId] || [])
          .map((childId) => idMap.get(childId))
          .filter(Boolean);
        if (mappedChildren.length) newChildOrder[newId] = mappedChildren;
      });
      const newRootId = idMap.get(id);
      let newRootOrder = [...d.rootOrder];
      if (source.parentId) {
        const siblings = [...(newChildOrder[source.parentId] || [])];
        const sourceIndex = siblings.indexOf(id);
        siblings.splice(sourceIndex === -1 ? siblings.length : sourceIndex + 1, 0, newRootId);
        newChildOrder[source.parentId] = [...new Set(siblings)];
      } else {
        const sourceIndex = newRootOrder.indexOf(id);
        newRootOrder.splice(sourceIndex === -1 ? newRootOrder.length : sourceIndex + 1, 0, newRootId);
      }
      return { ...d, pages: newPages, rootOrder: newRootOrder, childOrder: newChildOrder, currentPageId: newRootId };
    });
  };

  const deletePage = (id) => {
    if (!confirm("Delete this page and all its sub-pages?")) return;
    setData(d => {
      // collect descendants
      const toDelete = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        Object.values(d.pages).forEach(p => {
          if (toDelete.has(p.parentId) && !toDelete.has(p.id)) { toDelete.add(p.id); changed = true; }
        });
      }
      const newPages = { ...d.pages };
      toDelete.forEach(pid => delete newPages[pid]);
      const newRoot = d.rootOrder.filter(pid => !toDelete.has(pid));
      const newCO = {};
      Object.entries(d.childOrder || {}).forEach(([k, arr]) => {
        if (toDelete.has(k)) return;
        newCO[k] = arr.filter(pid => !toDelete.has(pid));
      });
      const newCurrent = toDelete.has(d.currentPageId) ? (newRoot[0] || Object.keys(newPages)[0]) : d.currentPageId;
      return { ...d, pages: newPages, rootOrder: newRoot, childOrder: newCO, currentPageId: newCurrent };
    });
  };

  const movePage = (pageId, newParentId, newIndex) => {
    setData(d => {
      // Remove from current position
      const page = d.pages[pageId];
      if (!page) return d;
      // prevent dropping onto self/descendants
      let cur = newParentId;
      while (cur) {
        if (cur === pageId) return d;
        cur = d.pages[cur]?.parentId;
      }

      const newPages = { ...d.pages, [pageId]: { ...page, parentId: newParentId } };
      let newRoot = [...d.rootOrder];
      const newCO = { ...d.childOrder };

      const sameParent = (page.parentId || null) === (newParentId || null);
      const oldIndex = page.parentId
        ? (newCO[page.parentId] || []).indexOf(pageId)
        : newRoot.indexOf(pageId);

      // Remove from old position
      if (page.parentId) {
        newCO[page.parentId] = (newCO[page.parentId] || []).filter(pid => pid !== pageId);
      } else {
        newRoot = newRoot.filter(pid => pid !== pageId);
      }

      // Insert at new position — adjust index when moving down within same parent
      // (removal already shifted later items up by one)
      let adjustedIndex = newIndex;
      if (sameParent && oldIndex !== -1 && newIndex != null && oldIndex < newIndex) {
        adjustedIndex = newIndex - 1;
      }
      if (newParentId) {
        const arr = [...(newCO[newParentId] || [])];
        const insertAt = adjustedIndex == null ? arr.length : adjustedIndex;
        arr.splice(insertAt, 0, pageId);
        newCO[newParentId] = arr;
      } else {
        const insertAt = adjustedIndex == null ? newRoot.length : adjustedIndex;
        newRoot.splice(insertAt, 0, pageId);
      }
      return { ...d, pages: newPages, rootOrder: newRoot, childOrder: newCO };
    });
  };

  // === Block operations ===
  const updateBlock = (block) => {
    if (!currentPage) return;
    updatePage(currentPage.id, { blocks: currentPage.blocks.map(b => b.id === block.id ? block : b) });
  };
  const deleteBlock = (blockId) => {
    if (!currentPage) return;
    const next = currentPage.blocks.filter(b => b.id !== blockId);
    updatePage(currentPage.id, { blocks: next.length ? next : [createTextBlock()] });
  };
  const addBlock = (block) => {
    if (!currentPage) return;
    updatePage(currentPage.id, { blocks: [...currentPage.blocks, block] });
  };
  const replaceBlock = (oldId, newBlock) => {
    if (!currentPage) return;
    updatePage(currentPage.id, { blocks: currentPage.blocks.map(b => b.id === oldId ? newBlock : b) });
  };
  const addBlockAfter = (afterId, block) => {
    if (!currentPage) return;
    const idx = currentPage.blocks.findIndex(b => b.id === afterId);
    if (idx === -1) {
      updatePage(currentPage.id, { blocks: [...currentPage.blocks, block] });
    } else {
      const next = [...currentPage.blocks];
      next.splice(idx + 1, 0, block);
      updatePage(currentPage.id, { blocks: next });
    }
  };

  const addBlockBefore = (beforeId, block) => {
    if (!currentPage) return;
    const idx = currentPage.blocks.findIndex(b => b.id === beforeId);
    const next = [...currentPage.blocks];
    next.splice(Math.max(0, idx), 0, block);
    updatePage(currentPage.id, { blocks: next });
  };

  const moveBlock = (dragId, targetId, position = "before") => {
    if (!currentPage || dragId === targetId) return;
    const blocks = [...currentPage.blocks];
    const from = blocks.findIndex(b => b.id === dragId);
    const to = blocks.findIndex(b => b.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = blocks.splice(from, 1);
    let insertAt = position === "after" ? to + 1 : to;
    if (from < insertAt) insertAt -= 1;
    blocks.splice(Math.max(0, insertAt), 0, moved);
    updatePage(currentPage.id, { blocks });
  };

  // === Backup ===
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `workspace-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          const importedData = parsed.pages && parsed.rootOrder
            ? parsed
            : parsed.data?.pages && parsed.data?.rootOrder
              ? parsed.data
              : null;
          if (!importedData) {
            alert("Invalid file");
            return;
          }
          const importedName = (parsed.name || parsed.workspaceName || file.name.replace(/\.json$/i, "") || "Imported workspace").trim();
          await createWorkspaceFromData(`${importedName} import`, normalizeWorkspaceData(importedData));
          alert("Workspace imported as a new workspace.");
        } catch { alert("Failed to parse"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  const resetWorkspace = () => {
    if (!confirm("Delete EVERYTHING and reset to defaults?")) return;
    setData(normalizeWorkspaceData(cloneDefaultWorkspace()));
  };

  const createWorkspace = async (rawName) => {
    const name = (rawName || "").trim();
    if (!name) return;
    const defaultData = createEmptyWorkspace();
    return createWorkspaceFromData(name, defaultData);
  };

  const createWorkspaceFromData = async (rawName, workspaceData) => {
    const name = (rawName || "").trim() || "Imported workspace";
    const defaultData = normalizeWorkspaceData(workspaceData || createEmptyWorkspace());
    if (window.WorkspaceStore?.canSave()) {
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Creating workspace" }));
      try {
        remoteReady.current = false;
        const created = await window.WorkspaceStore.createWorkspace(name, defaultData);
        setData(normalizeWorkspaceData(created.data));
        remoteReady.current = true;
        setSyncState((s) => ({
          ...s,
          busy: false,
          workspaceId: created.id,
          workspaceName: created.name,
          workspaces: created.workspaces,
          status: "Synced",
        }));
      } catch (error) {
        remoteReady.current = true;
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Create failed" }));
      }
      return;
    }

    const id = createWorkspaceId();
    const workspace = { id, name, updatedAt: new Date().toISOString() };
    const nextWorkspaces = [...localWorkspaces, workspace];
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
    localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, id);
    localStorage.setItem(localWorkspaceDataKey(id), JSON.stringify(defaultData));
    setLocalWorkspaces(nextWorkspaces);
    setActiveLocalWorkspaceId(id);
    setData(defaultData);
    setSyncState((s) => ({ ...s, workspaceId: id, workspaceName: name, workspaces: nextWorkspaces, status: "Local draft" }));
  };

  const deleteWorkspaceById = async (id) => {
    const workspaceList = syncState.user ? (syncState.workspaces || []) : localWorkspaces;
    const workspace = workspaceList.find((item) => item.id === id);
    if (!workspace) return;
    if (workspaceList.length <= 1) {
      alert("Create or import another workspace before deleting this one.");
      return;
    }
    if (!confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) return;

    if (window.WorkspaceStore?.canSave()) {
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Deleting workspace" }));
      try {
        const deleted = await window.WorkspaceStore.deleteWorkspace(id);
        setData(normalizeWorkspaceData(deleted.data));
        setSyncState((s) => ({
          ...s,
          busy: false,
          workspaceId: deleted.id,
          workspaceName: deleted.name,
          workspaces: deleted.workspaces,
          status: "Synced",
        }));
      } catch (error) {
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Delete failed" }));
      }
      return;
    }

    const nextWorkspaces = localWorkspaces.filter((item) => item.id !== id);
    const nextActive = id === activeLocalWorkspaceId ? nextWorkspaces[0] : localWorkspaces.find((item) => item.id === activeLocalWorkspaceId);
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
    localStorage.removeItem(localWorkspaceDataKey(id));
    localStorage.removeItem(localBackupKey(id));
    localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, nextActive.id);
    const nextData = loadLocalWorkspaceData(nextActive.id);
    setLocalWorkspaces(nextWorkspaces);
    setActiveLocalWorkspaceId(nextActive.id);
    setData(nextData);
    setSyncState((s) => ({
      ...s,
      workspaceId: nextActive.id,
      workspaceName: nextActive.name,
      workspaces: nextWorkspaces,
      status: "Local draft",
    }));
  };

  const renameWorkspace = async (id, rawName) => {
    const name = (rawName || "").trim();
    if (!id || !name) return;

    if (window.WorkspaceStore?.canSave()) {
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Renaming workspace" }));
      try {
        const renamed = await window.WorkspaceStore.renameWorkspace(id, name);
        setSyncState((s) => ({
          ...s,
          busy: false,
          workspaceId: renamed.id,
          workspaceName: renamed.name,
          workspaces: renamed.workspaces,
          status: "Synced",
        }));
      } catch (error) {
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Rename failed" }));
      }
      return;
    }

    const nextWorkspaces = localWorkspaces.map((workspace) => (
      workspace.id === id ? { ...workspace, name, updatedAt: new Date().toISOString() } : workspace
    ));
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
    setLocalWorkspaces(nextWorkspaces);
    const active = nextWorkspaces.find((workspace) => workspace.id === activeLocalWorkspaceId);
    setSyncState((s) => ({
      ...s,
      workspaceName: active?.name || s.workspaceName,
      workspaces: nextWorkspaces,
      status: "Local draft",
    }));
  };

  const switchWorkspace = async (id) => {
    if (!id || id === syncState.workspaceId) return;
    if (window.WorkspaceStore?.canSave()) {
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Switching workspace" }));
      try {
        remoteReady.current = false;
        const selected = await window.WorkspaceStore.switchWorkspace(id);
        setData(normalizeWorkspaceData(selected.data));
        remoteReady.current = true;
        setSyncState((s) => ({
          ...s,
          busy: false,
          workspaceId: selected.id,
          workspaceName: selected.name,
          workspaces: selected.workspaces,
          status: "Synced",
        }));
      } catch (error) {
        remoteReady.current = true;
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Switch failed" }));
      }
      return;
    }

    const workspace = localWorkspaces.find((item) => item.id === id);
    if (!workspace) return;
    setActiveLocalWorkspaceId(id);
    localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, id);
    setData(loadLocalWorkspaceData(id));
    setSyncState((s) => ({ ...s, workspaceId: id, workspaceName: workspace.name, workspaces: localWorkspaces, status: "Local draft" }));
  };

  const signIn = async (email) => {
    if (!window.WorkspaceStore?.isConfigured()) return;
    setSyncState((s) => ({ ...s, busy: true, error: "", status: "Sending sign-in link" }));
    try {
      await window.WorkspaceStore.signIn(email);
      setSyncState((s) => ({ ...s, busy: false, status: "Check your email" }));
    } catch (error) {
      setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Sign-in failed" }));
    }
  };

  const signOut = async () => {
    await window.WorkspaceStore?.signOut();
    remoteReady.current = false;
    setSyncState((s) => ({ ...s, user: null, workspaceId: null, role: null, accessDenied: false, status: "Signed out" }));
  };

  const inviteMember = async (email) => {
    setSyncState((s) => ({ ...s, busy: true, error: "", status: "Inviting member" }));
    try {
      await window.WorkspaceStore.inviteMember(email);
      setSyncState((s) => ({ ...s, busy: false, status: "Member added" }));
    } catch (error) {
      setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Invite failed" }));
    }
  };

  const configured = window.WorkspaceStore?.isConfigured();
  // Temporarily disabled for local testing
  // if (configured && !syncState.user) {
  //   return (
  //     <LoginScreen
  //       syncState={syncState}
  //       onSignIn={signIn}
  //     />
  //   );
  // }

  if (configured && syncState.user && syncState.accessDenied) {
    return (
      <AccessDeniedScreen
        syncState={syncState}
        onSignOut={signOut}
      />
    );
  }

  if (configured && syncState.user && !syncState.workspaceId) {
    return (
      <LoadingWorkspaceScreen
        syncState={syncState}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className={`app ${tocCollapsed ? "toc-collapsed" : ""}`}>
      <Sidebar
        data={data}
        setCurrentPage={setCurrentPage}
        addPage={addPage}
        deletePage={deletePage}
        duplicatePage={duplicatePage}
        movePage={movePage}
        exportData={exportData}
        importData={importData}
        resetWorkspace={resetWorkspace}
        syncState={syncState}
        onSignIn={signIn}
        onSignOut={signOut}
        onInviteMember={inviteMember}
        workspaces={syncState.user ? (syncState.workspaces || []) : localWorkspaces}
        activeWorkspaceId={syncState.user ? syncState.workspaceId : activeLocalWorkspaceId}
        onCreateWorkspace={createWorkspace}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={deleteWorkspaceById}
        onSwitchWorkspace={switchWorkspace}
        canManageWorkspace={!configured || syncState.role === "owner" || syncState.role === "admin"}
        onUndo={performUndo}
        onRedo={performRedo}
      />
      <PageEditor
        page={currentPage}
        updatePage={updatePage}
        updateBlock={updateBlock}
        deleteBlock={deleteBlock}
        addBlock={addBlock}
        addBlockAfter={addBlockAfter}
        replaceBlock={replaceBlock}
        moveBlock={moveBlock}
        data={data}
        setCurrentPage={setCurrentPage}
        addPage={addPage}
        presenceLocks={presenceLocks}
        onWordBoundary={forceHistoryCommit}
      />
      <TableOfContents page={currentPage} collapsed={tocCollapsed} onToggle={() => setTocCollapsed((value) => !value)} />
    </div>
  );
}

// ====== SIDEBAR with drag-and-drop ======
function Sidebar({
  data, setCurrentPage, addPage, deletePage, duplicatePage, movePage, exportData, importData, resetWorkspace,
  syncState, onSignIn, onSignOut, onInviteMember, workspaces, activeWorkspaceId,
  onCreateWorkspace, onRenameWorkspace, onDeleteWorkspace, onSwitchWorkspace, canManageWorkspace = false, onUndo, onRedo,
}) {
  const [expanded, setExpanded] = useState(() => {
    return {};
  });
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // {parentId, index}
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [renamingWorkspace, setRenamingWorkspace] = useState(false);
  const [workspaceRenameDraft, setWorkspaceRenameDraft] = useState("");
  const dropCommittedRef = useRef(false);

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const handleDragStart = (e, pageId) => {
    setDragId(pageId);
    dropCommittedRef.current = false;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pageId);
  };
  const handleDragEnd = () => {
    dropCommittedRef.current = false;
    setDragId(null);
    setDropTarget(null);
  };
  const handleDragOver = (e, parentId, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget((prev) => {
      if (prev && prev.parentId === parentId && prev.index === index) return prev;
      return { parentId, index };
    });
  };
  const commitDrop = (parentId, index) => {
    if (!dragId) return;
    dropCommittedRef.current = true;
    movePage(dragId, parentId, index);
    setDragId(null);
    setDropTarget(null);
  };

  const renderPage = (page, depth = 0, index = 0, parentId = null) => {
    const children = (data.childOrder?.[page.id] || []).map(id => data.pages[id]).filter(Boolean);
    const hasChildren = children.length > 0;
    const isActive = data.currentPageId === page.id;
    const isExpanded = expanded[page.id];
    const isDropAbove = dropTarget && dropTarget.parentId === parentId && dropTarget.index === index;

    return (
      <div key={page.id}>
        {isDropAbove && <div className="drop-line" />}
        <div
          className={`sidebar-item ${isActive ? "active" : ""} ${dragId === page.id ? "dragging" : ""}`}
          style={{ paddingLeft: 6 + depth * 16 }}
          draggable
          onDragStart={(e) => handleDragStart(e, page.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, parentId, index)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && dragId !== page.id) commitDrop(parentId, index);
          }}
          onClick={() => setCurrentPage(page.id)}
          title="Click to open, drag to move"
        >
          <span
            className="sidebar-drag-handle"
            onClick={(e) => e.stopPropagation()}
            title="Drag page"
          >
            ⋮⋮
          </span>
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); toggleExpand(page.id); }} className="sidebar-toggle">
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="sidebar-toggle-spacer" />
          )}
          <span className="sidebar-icon">{page.icon}</span>
          <span className="sidebar-title">{window.stripHtml ? window.stripHtml(page.title) : (page.title || "Untitled")}</span>
          {!page.system && (
            <div className="sidebar-actions">
              <button onClick={(e) => { e.stopPropagation(); addPage(page.id); setExpanded(x => ({ ...x, [page.id]: true })); }} title="Add sub-page" className="sidebar-action-btn">+</button>
              <button onClick={(e) => { e.stopPropagation(); duplicatePage?.(page.id); }} title="Duplicate page" className="sidebar-action-btn">⧉</button>
              <button onClick={(e) => { e.stopPropagation(); deletePage(page.id); }} title="Delete page" className="sidebar-action-btn">×</button>
            </div>
          )}
        </div>
        {isExpanded && children.map((c, ci) => renderPage(c, depth + 1, ci, page.id))}
        {isExpanded && hasChildren && (
          <div
            className="drop-zone"
            onDragOver={(e) => handleDragOver(e, page.id, children.length)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) commitDrop(page.id, children.length);
            }}
            style={{ paddingLeft: 6 + (depth + 1) * 16 }}
          >
            {dropTarget && dropTarget.parentId === page.id && dropTarget.index === children.length && <div className="drop-line" />}
          </div>
        )}
      </div>
    );
  };

  const rootPages = data.rootOrder.map(id => data.pages[id]).filter(Boolean);
  const activeWorkspace = (workspaces || []).find((workspace) => workspace.id === activeWorkspaceId);
  const todayMeta = useMemo(() => formatWorkspaceDate(new Date()), []);
  const submitWorkspace = (e) => {
    e.preventDefault();
    const name = workspaceNameDraft.trim();
    if (!name) return;
    onCreateWorkspace(name);
    setWorkspaceNameDraft("");
    setCreatingWorkspace(false);
  };
  const startRenamingWorkspace = () => {
    setCreatingWorkspace(false);
    setRenamingWorkspace(true);
    setWorkspaceRenameDraft(activeWorkspace?.name || "");
  };
  const submitWorkspaceRename = (e) => {
    e.preventDefault();
    const name = workspaceRenameDraft.trim();
    if (!name) return;
    onRenameWorkspace(activeWorkspaceId, name);
    setRenamingWorkspace(false);
    setWorkspaceRenameDraft("");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="workspace-switcher">
          <select
            className="workspace-select"
            value={activeWorkspaceId || ""}
            onChange={(e) => onSwitchWorkspace(e.target.value)}
            title="Switch workspace"
          >
            {(workspaces || []).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
          <button className="workspace-edit-btn" onClick={startRenamingWorkspace} disabled={!canManageWorkspace} title="Rename workspace" type="button">✎</button>
          <button className="workspace-create-btn" onClick={() => { setRenamingWorkspace(false); setCreatingWorkspace((value) => !value); }} disabled={!canManageWorkspace} title="New workspace" type="button">+</button>
          <button className="workspace-delete-btn" onClick={() => onDeleteWorkspace?.(activeWorkspaceId)} disabled={!canManageWorkspace || (workspaces || []).length <= 1} title="Delete workspace" type="button">×</button>
        </div>
        <div className="workspace-date-nav">
          <span>{todayMeta.weekLabel}</span>
          <span>{todayMeta.dateLabel}</span>
        </div>
        {creatingWorkspace && (
          <form className="workspace-create-form" onSubmit={submitWorkspace}>
            <input
              className="workspace-create-input"
              value={workspaceNameDraft}
              onChange={(e) => setWorkspaceNameDraft(e.target.value)}
              placeholder="Workspace name"
              autoFocus
            />
            <button className="workspace-create-submit" type="submit">Create</button>
          </form>
        )}
        {renamingWorkspace && (
          <form className="workspace-create-form" onSubmit={submitWorkspaceRename}>
            <input
              className="workspace-create-input"
              value={workspaceRenameDraft}
              onChange={(e) => setWorkspaceRenameDraft(e.target.value)}
              placeholder="Rename workspace"
              autoFocus
            />
            <button className="workspace-create-submit" type="submit">Save</button>
          </form>
        )}
        <div className="workspace-sub">{Object.keys(data.pages).length} pages · ready</div>
      </div>
      <div className="sidebar-tree"
        onDragOver={(e) => {
          // bottom drop zone for root
          e.preventDefault();
        }}>
        {rootPages.map((p, i) => renderPage(p, 0, i, null))}
        {/* bottom drop target */}
        <div
          className="drop-zone-root"
          onDragOver={(e) => handleDragOver(e, null, rootPages.length)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) commitDrop(null, rootPages.length);
          }}
        >
          {dropTarget && dropTarget.parentId === null && dropTarget.index === rootPages.length && <div className="drop-line" />}
        </div>
      </div>
      <div className="sidebar-footer">
        <button onClick={() => addPage(null)} className="new-page-btn">+ New page</button>
        <div className="sidebar-util">
          <button onClick={onUndo} className="util-btn" title="Undo">↶</button>
          <button onClick={onRedo} className="util-btn" title="Redo">↷</button>
          <button onClick={exportData} className="util-btn" title="Download backup">⬇</button>
          <button onClick={importData} className="util-btn" title="Import as new workspace">⬆</button>
          <button onClick={resetWorkspace} className="util-btn" title="Reset">↺</button>
        </div>
        <SyncPanel
          syncState={syncState}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onInviteMember={onInviteMember}
          canInvite={canManageWorkspace}
        />
      </div>
    </aside>
  );
}

function SyncPanel({ syncState, onSignIn, onSignOut, onInviteMember, canInvite = false }) {
  const [email, setEmail] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const configured = syncState.mode === "supabase";
  const authed = !!syncState.user;
  const badgeClass = authed ? "ok" : configured ? "warn" : "warn";

  return (
    <div className="sync-panel">
      <div className="sync-row">
        <span>{configured ? "Team workspace" : "Local workspace"}</span>
        <span className={`sync-badge ${badgeClass}`}>{authed ? "Connected" : configured ? "Login required" : "Local"}</span>
      </div>
      {syncState.error && <div className="workspace-sub" style={{ color:"#ff7369", marginTop:6 }}>{syncState.error}</div>}

      {!configured && (
        <div className="workspace-sub" style={{ marginTop:8 }}>
          Add Supabase keys in workspace-config.js to enable secure team sync.
        </div>
      )}

      {configured && !authed && (
        <>
          <input
            className="sync-input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="sync-actions">
            <button className="sync-btn primary" disabled={syncState.busy} onClick={() => email && onSignIn(email)}>Sign in</button>
            <button className="sync-btn" onClick={exportLocalBackup}>Backup</button>
          </div>
        </>
      )}

      {configured && authed && (
        <>
          <div className="workspace-sub" style={{ marginTop:8, overflow:"hidden", textOverflow:"ellipsis" }}>
            {syncState.user.email}
          </div>
          <div className="workspace-sub" style={{ marginTop:6 }}>
            Role: {syncState.role || "member"}{syncState.role === "owner" ? " · can invite teammates" : ""}
          </div>
          {canInvite && (
            <input
              className="sync-input"
              type="email"
              placeholder="teammate email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          )}
          <div className="sync-actions">
            {canInvite && <button className="sync-btn primary" disabled={syncState.busy} onClick={() => inviteEmail && onInviteMember(inviteEmail)}>Invite</button>}
            <button className="sync-btn" onClick={onSignOut}>Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}

function exportLocalBackup() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  const blob = new Blob([saved], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workspace-local-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function LoginScreen({ syncState, onSignIn }) {
  const [email, setEmail] = useState("");
  const ownerEmail = window.SUPABASE_CONFIG?.ownerEmail || "workspace owner";
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <div className="auth-kicker">Team workspace</div>
        <h1>Sign in to continue</h1>
        <p>Your documents are stored in the shared Supabase workspace. Only invited emails can open the editor.</p>
        <input
          className="auth-input"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email) onSignIn(email);
          }}
        />
        <button className="auth-btn" disabled={syncState.busy || !email} onClick={() => onSignIn(email)}>
          Send magic link
        </button>
        <div className="auth-note">Owner: {ownerEmail}</div>
        {syncState.status && <div className="auth-status">{syncState.status}</div>}
        {syncState.error && <div className="auth-error">{syncState.error}</div>}
      </section>
    </main>
  );
}

function AccessDeniedScreen({ syncState, onSignOut }) {
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <div className="auth-kicker">Access required</div>
        <h1>Workspace invite needed</h1>
        <p>{syncState.error || "This email has not been invited by the workspace owner yet."}</p>
        <div className="auth-note">Signed in as {syncState.user?.email}</div>
        <button className="auth-btn secondary" onClick={onSignOut}>Use another email</button>
      </section>
    </main>
  );
}

function LoadingWorkspaceScreen({ syncState, onSignOut }) {
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <div className="auth-kicker">Loading</div>
        <h1>Opening workspace</h1>
        <p>{syncState.status || "Preparing your shared documents."}</p>
        {syncState.error && <div className="auth-error">{syncState.error}</div>}
        <button className="auth-btn secondary" onClick={onSignOut}>Sign out</button>
      </section>
    </main>
  );
}

// ====== PAGE EDITOR ======
function PageEditor({ page, updatePage, updateBlock, deleteBlock, addBlock, addBlockAfter, replaceBlock, moveBlock, data, setCurrentPage, addPage, presenceLocks = {}, onWordBoundary }) {
  // Make forceHistoryCommit available globally so EditableText can call it on word boundaries
  useEffect(() => { window.__onWordBoundary = onWordBoundary; }, [onWordBoundary]);

  const downloadPageAsPdf = () => {
    if (!page) return;
    const stripHtml = (h) => (h || "").replace(/<[^>]*>/g, "");
    const listLevel = (item) => Math.max(0, Math.min(2, Number(item?.level ?? (item?.indent ? 1 : 0)) || 0));
    const textIndentLevel = (block) => Math.max(0, Math.min(2, Number(block?.textIndentLevel) || 0));
    const bulletStyle = ["disc", "circle", "square"];
    const numberStyle = ["decimal", "lower-alpha", "lower-roman"];
    const renderListItems = (items, styles) => (items || []).map((item) => {
      const level = listLevel(item);
      return `<li style="margin-left:${level * 24}px;list-style-type:${styles[level]}">${item.text || ""}</li>`;
    }).join("");
    const blocks = page.blocks || [];
    let bodyHtml = "";
    for (const block of blocks) {
      switch (block.type) {
        case "heading": bodyHtml += `<h${block.level} style="margin:1em 0 0.3em">${block.text || ""}</h${block.level}>\n`; break;
        case "text": bodyHtml += `<p style="margin:0.4em 0 0.4em ${textIndentLevel(block) * 24}px">${block.text || "&nbsp;"}</p>\n`; break;
        case "bullets": bodyHtml += `<ul>${renderListItems(block.items, bulletStyle)}</ul>\n`; break;
        case "numbers": bodyHtml += `<ol>${renderListItems(block.items, numberStyle)}</ol>\n`; break;
        case "checklist": bodyHtml += `<ul style="list-style:none;padding:0">${(block.items||[]).map(i=>`<li>${i.done?"☑":"☐"} ${stripHtml(i.text||"")}</li>`).join("")}</ul>\n`; break;
        case "callout": bodyHtml += `<blockquote style="background:#f8f8f0;border-left:4px solid #e0c97f;padding:10px 16px;margin:12px 0;border-radius:4px">${block.icon||"💡"} ${block.text||""}</blockquote>\n`; break;
        case "divider": bodyHtml += `<hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>\n`; break;
        case "image": bodyHtml += block.src ? `<img src="${block.src}" style="max-width:100%;border-radius:6px;margin:8px 0"/>\n` : ""; break;
        case "table": {
          const rows = block.rows || [];
          bodyHtml += `<table style="border-collapse:collapse;width:100%;margin:12px 0">`;
          rows.forEach((row, ri) => {
            bodyHtml += "<tr>";
            (row||[]).forEach(cell => {
              const tag = ri === 0 ? "th" : "td";
              bodyHtml += `<${tag} style="border:1px solid #ddd;padding:6px 10px;${ri===0?"background:#f5f5f5;font-weight:600":"background:#fff"}">${cell||""}</${tag}>`;
            });
            bodyHtml += "</tr>";
          });
          bodyHtml += "</table>\n";
          break;
        }
        case "milestones": bodyHtml += `<ul>${(block.items||[]).map(i=>`<li><b>${stripHtml(i.name||"")}</b> [${i.status||"pending"}]</li>`).join("")}</ul>\n`; break;
        case "kpis": {
          const kpiHtml = (block.items||[]).map(item => {
            const pct = item.target ? Math.round((parseFloat(item.value)||0)/(parseFloat(item.target)||1)*100) : null;
            return `<div style="display:inline-block;min-width:140px;margin:6px;padding:12px 16px;border:1px solid #ddd;border-radius:8px;vertical-align:top">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:4px">${stripHtml(item.label||"Metric")}</div>
              <div style="font-size:28px;font-weight:800;color:#111">${stripHtml(item.value||"0")}${item.unit||""}</div>
              ${pct!==null?`<div style="height:4px;background:#eee;border-radius:2px;margin-top:6px"><div style="height:100%;width:${Math.min(100,pct)}%;background:#3dd68c;border-radius:2px"></div></div>`:""}</div>`;
          }).join("");
          bodyHtml += `<div style="margin:12px 0">${kpiHtml}</div>\n`;
          break;
        }
        case "progress": {
          const pct = Math.min(100,Math.round((Number(block.value)||0)/(Math.max(1,Number(block.total)||100))*100));
          bodyHtml += `<div style="margin:12px 0"><div style="font-size:13px;font-weight:600;margin-bottom:6px">${stripHtml(block.label||"Progress")} — ${pct}%</div><div style="height:8px;background:#eee;border-radius:4px"><div style="height:100%;width:${pct}%;background:#58c4d4;border-radius:4px"></div></div></div>\n`;
          break;
        }
        default: break;
      }
    }
    const pageTitle = stripHtml(page.title || "Untitled");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pageTitle}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.6}
      h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.2em}
      p,li{font-size:1em}
      ul,ol{padding-left:24px}
      @media print{body{margin:0;padding:16px}}
    </style></head><body>
    <h1 style="font-size:2.2em;margin-bottom:0.2em">${page.icon ? page.icon+" " : ""}${pageTitle}</h1>
    ${page.date ? `<p style="color:#888;margin-top:0;font-size:0.9em">${page.date}</p>` : ""}
    ${bodyHtml}
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) { const a = document.createElement("a"); a.href = url; a.download = pageTitle+".html"; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const [slash, setSlash] = useState(null); // { query, rect, onPick }
  const [focusBlockId, setFocusBlockId] = useState(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [dragBlockId, setDragBlockId] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState(new Set());
  const [marquee, setMarquee] = useState(null);
  const [formatBar, setFormatBar] = useState(null); // { rect, blockId }
  const pageBodyRef = useRef(null);
  const marqueeRef = useRef(null);
  const textSelectionDragRef = useRef(null);
  const blocks = page?.blocks || [];
  const focusBlock = (id) => {
    setFocusBlockId(id);
    setFocusNonce((value) => value + 1);
  };

  // Stable ref so the selectionchange listener always sees the latest blocks
  // without needing to re-subscribe on every keystroke.
  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; });

  // Show inline format-bar when the user selects text within a single block.
  useEffect(() => {
    const updateFormatBarPosition = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setFormatBar(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const pb = pageBodyRef.current;
      if (!pb || !pb.contains(range.commonAncestorContainer)) { setFormatBar(null); return; }
      const blockEl = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer.closest("[data-block-id]")
        : range.commonAncestorContainer.parentElement?.closest("[data-block-id]");
      if (!blockEl) { setFormatBar(null); return; }
      const blockId = blockEl.dataset.blockId;
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { setFormatBar(null); return; }
      setFormatBar({ blockId, rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width } });
    };
    document.addEventListener("selectionchange", updateFormatBarPosition);
    window.addEventListener("scroll", updateFormatBarPosition, true);
    window.addEventListener("resize", updateFormatBarPosition);
    return () => {
      document.removeEventListener("selectionchange", updateFormatBarPosition);
      window.removeEventListener("scroll", updateFormatBarPosition, true);
      window.removeEventListener("resize", updateFormatBarPosition);
    };
  }, []);

  // Detect when the browser selection spans >1 block and highlight them.
  // This works for Shift+click across blocks (native cross-contentEditable selection).
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setMultiSelectedIds((prev) => (prev.size > 0 ? new Set() : prev));
        return;
      }
      const range = sel.getRangeAt(0);
      const pb = pageBodyRef.current;
      if (!pb || !pb.contains(range.commonAncestorContainer)) {
        setMultiSelectedIds((prev) => (prev.size > 0 ? new Set() : prev));
        return;
      }
      const ids = blocksRef.current
        .filter((b) => {
          const el = pb.querySelector(`[data-block-id="${b.id}"]`);
          if (!el) return false;
          try { return range.intersectsNode(el); } catch { return false; }
        })
        .map((b) => b.id);
      setMultiSelectedIds(ids.length > 1 ? new Set(ids) : new Set());
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []); // subscribe once; reads latest blocks via blocksRef

  // Intercept copy so pasted content preserves block structure (headings stay headings, etc.)
  useEffect(() => {
    const pageBody = pageBodyRef.current;
    if (!pageBody) return;
    const onCopy = (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!pageBody.contains(range.commonAncestorContainer)) return;
      const touched = blocksRef.current.filter((b) => {
        const el = pageBody.querySelector(`[data-block-id="${b.id}"]`);
        if (!el) return false;
        try { return range.intersectsNode(el); } catch { return false; }
      });
      if (!touched.length) return;

      let html, text;
      if (touched.length === 1) {
        const block = touched[0];
        // Extract the user's actual selected HTML from the contentEditable
        const frag = range.cloneContents();
        const tmp = document.createElement("div");
        tmp.appendChild(frag);
        const inner = window.sanitizeHtml ? window.sanitizeHtml(tmp.innerHTML) : tmp.innerHTML;
        const innerText = tmp.textContent || "";
        switch (block.type) {
          case "heading": html = `<h${block.level}>${inner}</h${block.level}>`; text = `${"#".repeat(block.level)} ${innerText}`; break;
          case "bullets": html = `<ul><li>${inner}</li></ul>`; text = `- ${innerText}`; break;
          case "numbers": html = `<ol><li>${inner}</li></ol>`; text = `1. ${innerText}`; break;
          case "callout": html = `<blockquote>${inner}</blockquote>`; text = `> ${innerText}`; break;
          default:        html = `<p>${inner}</p>`; text = innerText; break;
        }
      } else {
        html = touched.map((b) => window.serializeBlockToHtml ? window.serializeBlockToHtml(b) : "").join("\n");
        text = touched.map((b) => window.serializeBlockToText ? window.serializeBlockToText(b) : "").join("\n\n");
      }

      e.clipboardData.setData("text/html", `<!--StartFragment-->${html}<!--EndFragment-->`);
      e.clipboardData.setData("text/plain", text);
      e.preventDefault();
    };
    pageBody.addEventListener("copy", onCopy);
    return () => pageBody.removeEventListener("copy", onCopy);
  }, []);

  useEffect(() => {
    if (!page || page.system || blocks.length > 0) return;
    const block = createTextBlock();
    updatePage(page.id, { blocks: [block] });
    focusBlock(block.id);
  }, [page?.id, blocks.length]);

  const slashRectFromAnchor = (anchorEl, fallbackRect) => {
    if (!anchorEl) return fallbackRect;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && anchorEl.contains(sel.anchorNode)) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return rect;
    }
    return anchorEl.getBoundingClientRect();
  };

  const showSlash = (query, rect, replaceBlockCb, anchorEl = null) => {
    setSlash({ query, rect: slashRectFromAnchor(anchorEl, rect), replaceBlockCb, anchorEl });
  };
  const hideSlash = () => setSlash(null);

  useEffect(() => {
    if (!slash?.anchorEl) return;
    const updateSlashPosition = () => {
      setSlash((current) => current?.anchorEl
        ? { ...current, rect: slashRectFromAnchor(current.anchorEl, current.rect) }
        : current
      );
    };
    window.addEventListener("scroll", updateSlashPosition, true);
    window.addEventListener("resize", updateSlashPosition);
    return () => {
      window.removeEventListener("scroll", updateSlashPosition, true);
      window.removeEventListener("resize", updateSlashPosition);
    };
  }, [slash?.anchorEl]);

  const pickSlash = (cmd) => {
    if (slash?.replaceBlockCb) {
      slash.replaceBlockCb(cmd);
    }
    setSlash(null);
  };

  const exitBlockToText = (blockId, updatedBlock) => {
    if (!page) return;
    const id = window.nid();
    const nextTextBlock = { id, type:"text", text:"" };
    const nextBlocks = blocks.flatMap((block) => {
      if (block.id !== blockId) return [block];
      if (updatedBlock?.items && updatedBlock.items.length === 0) return [nextTextBlock];
      return [updatedBlock || block, nextTextBlock];
    });
    updatePage(page.id, { blocks: nextBlocks });
    focusBlock(id);
  };

  const deleteEmptyBlock = (blockId) => {
    if (!page || page.system) return;
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index === -1) return;
    if (blocks.length === 1) {
      const only = { id: blockId, type:"text", text:"" };
      updatePage(page.id, { blocks: [only] });
      focusBlock(blockId);
      return;
    }
    const next = blocks.filter((block) => block.id !== blockId);
    const focusTarget = next[Math.max(0, index - 1)] || next[0];
    updatePage(page.id, { blocks: next });
    if (focusTarget) focusBlock(focusTarget.id);
  };

  const convertBlockToText = (blockId, text = "") => {
    if (!page || page.system) return;
    updatePage(page.id, {
      blocks: blocks.map((block) => block.id === blockId ? { id: blockId, type:"text", text } : block),
    });
    focusBlock(blockId);
  };

  const convertBlockType = (blockId, targetType, level) => {
    if (!page || page.system) return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    // Extract plain text from the block for conversion
    const getText = (b) => {
      if (b.type === "text" || b.type === "heading" || b.type === "callout") return window.stripHtml ? window.stripHtml(b.text || "") : (b.text || "");
      if (b.type === "bullets" || b.type === "numbers") return (b.items || []).map(i => window.stripHtml ? window.stripHtml(i.text || "") : (i.text || "")).join(" ");
      return "";
    };
    const text = block.type === "text" || block.type === "heading"
      ? (block.text || "")
      : window.sanitizeHtml ? window.sanitizeHtml(getText(block)) : getText(block);
    let newBlock;
    if (targetType === "text") {
      newBlock = { id: blockId, type:"text", text };
    } else if (targetType === "heading") {
      newBlock = { id: blockId, type:"heading", level: level || 1, text };
    } else if (targetType === "bullets") {
      const plainText = window.stripHtml ? window.stripHtml(text) : text;
      newBlock = { id: blockId, type:"bullets", items: [{ id: window.nid(), text: plainText ? window.sanitizeHtml(plainText) : "" }] };
    } else if (targetType === "numbers") {
      const plainText = window.stripHtml ? window.stripHtml(text) : text;
      newBlock = { id: blockId, type:"numbers", items: [{ id: window.nid(), text: plainText ? window.sanitizeHtml(plainText) : "" }] };
    } else {
      return;
    }
    updatePage(page.id, { blocks: blocks.map((b) => b.id === blockId ? newBlock : b) });
    setFormatBar(null);
    window.getSelection()?.removeAllRanges();
    focusBlock(blockId);
  };

  const replaceBlockWithBlocks = (blockId, replacementBlocks, focusId) => {
    if (!page || page.system || !Array.isArray(replacementBlocks)) return;
    updatePage(page.id, {
      blocks: blocks.flatMap((block) => block.id === blockId ? replacementBlocks : [block]),
    });
    if (focusId) focusBlock(focusId);
  };

  const selectedBlockIds = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const pageBody = document.querySelector(".page-body");
    if (!pageBody || !pageBody.contains(range.commonAncestorContainer)) return [];
    return blocks
      .filter((block) => {
        const el = pageBody.querySelector(`[data-block-id="${block.id}"]`);
        if (!el) return false;
        try { return range.intersectsNode(el); } catch { return false; }
      })
      .map((block) => block.id);
  };

  const selectAllBlocks = () => {
    const pageBody = pageBodyRef.current;
    const selection = window.getSelection();
    if (!pageBody || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(pageBody);
    selection.removeAllRanges();
    selection.addRange(range);
    const ids = blocks.map((block) => block.id);
    setMultiSelectedIds(new Set(ids));
  };

  const isStructuredPaste = (text = "") => {
    const trimmed = String(text).trim();
    return Boolean(trimmed) && (
      trimmed.includes("\n") ||
      /^(#{1,3}\s|[-*]\s|\d+[.)]\s|>\s|\|)/m.test(trimmed)
    );
  };

  const handlePagePaste = (e) => {
    if (e.defaultPrevented) return;
    if (!page || page.system || !window.parseMarkdownishBlocks) return;
    const text = e.clipboardData?.getData("text/plain") || "";
    const clipHtml = e.clipboardData?.getData("text/html") || "";

    // Prefer HTML parsing for rich-text sources (Notion, Google Docs, Word).
    // Fall back to plain-text markdown parsing for ChatGPT / raw markdown.
    let parsedBlocks = null;
    if (clipHtml && window.parseHtmlBlocks) {
      const htmlBlocks = window.parseHtmlBlocks(clipHtml);
      if (htmlBlocks.length > 1 || (htmlBlocks.length === 1 && htmlBlocks[0].type !== "text")) {
        parsedBlocks = htmlBlocks;
      }
    }
    if (!parsedBlocks) {
      if (!isStructuredPaste(text)) return;
      parsedBlocks = window.parseMarkdownishBlocks(text);
    }

    const blockEl = e.target.closest?.("[data-block-id]");
    const targetId = blockEl?.dataset?.blockId;
    if (!parsedBlocks.length) return;

    e.preventDefault();
    e.stopPropagation();

    const insertIndex = targetId ? blocks.findIndex((block) => block.id === targetId) : -1;
    let nextBlocks;
    if (insertIndex === -1) {
      const trailingBlank = blocks.length && blocks[blocks.length - 1]?.type === "text" && isBlankTextBlock(blocks[blocks.length - 1]);
      nextBlocks = trailingBlank
        ? [...blocks.slice(0, -1), ...parsedBlocks, blocks[blocks.length - 1]]
        : [...blocks, ...parsedBlocks];
    } else {
      const target = blocks[insertIndex];
      const replaceTarget = target?.type === "text" && isBlankTextBlock(target);
      nextBlocks = replaceTarget
        ? [...blocks.slice(0, insertIndex), ...parsedBlocks, ...blocks.slice(insertIndex + 1)]
        : [...blocks.slice(0, insertIndex + 1), ...parsedBlocks, ...blocks.slice(insertIndex + 1)];
    }

    updatePage(page.id, { blocks: nextBlocks });
    focusBlock(parsedBlocks[0].id);
    window.getSelection()?.removeAllRanges();
  };

  const selectedIdsFromRect = (rect) => {
    const pageBody = pageBodyRef.current;
    if (!pageBody || !rect) return [];
    return blocks
      .filter((block) => {
        const el = pageBody.querySelector(`[data-block-id="${block.id}"]`);
        if (!el) return false;
        const blockRect = el.getBoundingClientRect();
        return blockRect.bottom >= rect.top && blockRect.top <= rect.bottom;
      })
      .map((block) => block.id);
  };

  const beginBlockMarquee = (e) => {
    if (e.button !== 0 || !pageBodyRef.current) return;
    const interactive = e.target.closest?.('[contenteditable="true"], input, textarea, select, button, .block-delete-btn, .table-block, .kpi-card, .milestone-row');
    if (interactive) return;
    const bodyRect = pageBodyRef.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    marqueeRef.current = { start, current: start };
    setMarquee({ left: bodyRect.left, top: start.y, width: bodyRect.width, height: 1 });
    setMultiSelectedIds(new Set());
    window.getSelection()?.removeAllRanges();
    e.preventDefault();
    e.stopPropagation();
  };

  const rangeFromPoint = (x, y) => {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      return range;
    }
    return null;
  };

  const beginNaturalTextSelection = (e) => {
    const pageBody = pageBodyRef.current;
    if (!pageBody || e.button !== 0 || e.defaultPrevented) return;
    if (!pageBody.contains(e.target)) return;
    const blocked = e.target.closest?.("button, input, textarea, select, .tbl-wrap, .block-delete-btn, .tbl-resize-handle, .task-category-select, .calendar-month-input");
    if (blocked) return;
    const startRange = rangeFromPoint(e.clientX, e.clientY);
    if (!startRange || !pageBody.contains(startRange.startContainer)) return;
    textSelectionDragRef.current = {
      startRange,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      const drag = textSelectionDragRef.current;
      const pageBody = pageBodyRef.current;
      if (!drag || !pageBody) return;
      const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (!drag.active && distance < 6) return;
      const endRange = rangeFromPoint(e.clientX, e.clientY);
      if (!endRange || !pageBody.contains(endRange.startContainer)) return;
      drag.active = true;
      const selection = window.getSelection();
      try {
        selection.collapse(drag.startRange.startContainer, drag.startRange.startOffset);
        selection.extend(endRange.startContainer, endRange.startOffset);
      } catch {
        return;
      }
      const ids = selectedBlockIds();
      setMultiSelectedIds(ids.length > 1 ? new Set(ids) : new Set());
    };
    const onUp = () => {
      textSelectionDragRef.current = null;
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
    };
  }, [blocks]);

  useEffect(() => {
    if (!marquee) return;
    const onMove = (e) => {
      const drag = marqueeRef.current;
      const pageBody = pageBodyRef.current;
      if (!drag || !pageBody) return;
      drag.current = { x: e.clientX, y: e.clientY };
      const bodyRect = pageBody.getBoundingClientRect();
      const top = Math.min(drag.start.y, drag.current.y);
      const bottom = Math.max(drag.start.y, drag.current.y);
      const rect = { left: bodyRect.left, top, right: bodyRect.right, bottom };
      setMarquee({ left: rect.left, top: rect.top, width: bodyRect.width, height: Math.max(2, rect.bottom - rect.top) });
      setMultiSelectedIds(new Set(selectedIdsFromRect(rect)));
    };
    const onUp = (e) => {
      onMove(e);
      marqueeRef.current = null;
      setMarquee(null);
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
    };
  }, [marquee, blocks]);

  const deleteSelectedBlocks = (ids) => {
    if (!page || page.system || ids.length < 2) return;
    const selected = new Set(ids);
    const firstIndex = blocks.findIndex((block) => selected.has(block.id));
    const nextBlocks = blocks.filter((block) => !selected.has(block.id));
    const fallbackBlock = createTextBlock();
    const finalBlocks = nextBlocks.length ? nextBlocks : [fallbackBlock];
    const focusTarget = finalBlocks[Math.max(0, Math.min(firstIndex, finalBlocks.length - 1))] || fallbackBlock;
    updatePage(page.id, { blocks: finalBlocks });
    focusBlock(focusTarget.id);
    window.getSelection()?.removeAllRanges();
  };

  const handleBlockDrop = (targetId, position = "before") => {
    if (dragBlockId && dragBlockId !== targetId) moveBlock(dragBlockId, targetId, position);
    setDragBlockId(null);
  };

  const markEditingBlock = (blockId) => {
    if (!page || page.system) return;
    window.WorkspaceStore?.setEditingBlock?.(page.id, blockId);
  };

  const clearEditingBlock = () => {
    window.WorkspaceStore?.clearEditingBlock?.();
  };

  if (!page) return <div className="page-empty">No page selected</div>;
  if (page.id === TASK_INDEX_PAGE_ID) {
    return (
      <TaskIndexPage
        data={data}
        setCurrentPage={setCurrentPage}
        updatePage={updatePage}
      />
    );
  }

  return (
    <main className="page-main">
      <div className="page-container" key={page.id}>
        <div className="page-header">
          <window.EditableText
            value={page.icon}
            onChange={(v) => updatePage(page.id, { icon: v })}
            style={{ fontSize:54, lineHeight:1, cursor:"text", minWidth:60, marginBottom:8 }}
          />
          <window.EditableText
            value={page.title}
            onChange={(v) => updatePage(page.id, { title: v })}
            placeholder="Untitled"
            selectOnFocus={true}
            style={{
              fontSize:40, fontWeight:700, color:"var(--text-strong)",
              lineHeight:1.18, letterSpacing:0,
              margin:"6px 0 30px",
            }}
          />
          <div className="page-date-row">
            <span className="page-date-label">Date</span>
            <input
              className="page-date-input"
              type="date"
              value={page.date || ""}
              onInput={(e) => updatePage(page.id, { date: e.target.value })}
              onChange={(e) => updatePage(page.id, { date: e.target.value })}
            />
            {page.date && (
              <button className="page-date-clear" type="button" onClick={() => updatePage(page.id, { date: "" })}>
                Clear
              </button>
            )}
          </div>
          <button
            className="page-pdf-btn"
            type="button"
            title="Download as PDF"
            onClick={downloadPageAsPdf}
          >
            ↓ PDF
          </button>
        </div>

        <div
          ref={pageBodyRef}
          className={`page-body ${marquee ? "selecting-blocks" : ""}`}
          onMouseDownCapture={beginNaturalTextSelection}
          onMouseDown={beginBlockMarquee}
          onPasteCapture={handlePagePaste}
          onKeyDownCapture={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
              e.preventDefault();
              e.stopPropagation();
              selectAllBlocks();
              return;
            }
            if (e.key !== "Backspace" && e.key !== "Delete") return;
            const ids = multiSelectedIds.size ? [...multiSelectedIds] : selectedBlockIds();
            if (ids.length < 2) return;
            e.preventDefault();
            e.stopPropagation();
            deleteSelectedBlocks(ids);
          }}
        >
          {blocks.map((block, idx) => (
            <window.Block
              key={block.id}
              block={block}
              dragging={dragBlockId === block.id}
              autoFocus={focusBlockId === block.id}
              focusKey={focusNonce}
              isLast={idx === blocks.length - 1}
              multiSelected={multiSelectedIds.has(block.id)}
              updateBlock={updateBlock}
              data={data}
              pageBlocks={blocks}
              setCurrentPage={setCurrentPage}
              lockedBy={presenceLocks[block.id]}
              onBeginEditing={() => markEditingBlock(block.id)}
              onEndEditing={clearEditingBlock}
              onDeleteEmpty={() => deleteEmptyBlock(block.id)}
              onDeleteBlock={() => deleteBlock(block.id)}
              onConvertToText={(text) => convertBlockToText(block.id, text)}
              onMarkdownShortcut={(type) => {
                if (type === "bullets") {
                  replaceBlock(block.id, { id: block.id, type:"bullets", items:[{ id: window.nid(), text:"" }] });
                }
                if (type === "numbers") {
                  replaceBlock(block.id, { id: block.id, type:"numbers", items:[{ id: window.nid(), text:"" }] });
                }
                focusBlock(block.id);
              }}
              onReplaceBlock={(replacementBlocks, focusId) => replaceBlockWithBlocks(block.id, replacementBlocks, focusId)}
              onDragBlockStart={(id) => setDragBlockId(id)}
              onDragBlockEnd={() => setDragBlockId(null)}
              onDropBlock={(targetId, position) => handleBlockDrop(targetId, position)}
              onAddBlockAfter={() => {
                const id = window.nid();
                addBlockAfter(block.id, { id, type:"text", text:"" });
                focusBlock(id);
              }}
              onAddBlockBefore={() => {
                const id = window.nid();
                addBlockBefore(block.id, { id, type:"text", text:"" });
                focusBlock(id);
              }}
              onExitBlock={(updatedBlock) => exitBlockToText(block.id, updatedBlock)}
              onSlashCommandShow={(query, rect, clearCb, anchorEl) => {
                showSlash(query, rect, (cmd) => {
                  const newBlock = cmd.make();
                  if (window.blockNeedsTrailingText?.(newBlock.type)) {
                    const textBlock = createTextBlock();
                    replaceBlockWithBlocks(block.id, [newBlock, textBlock], textBlock.id);
                  } else {
                    replaceBlock(block.id, newBlock);
                    focusBlock(newBlock.id);
                  }
                }, anchorEl);
              }}
              onSlashCommandHide={hideSlash}
            />
          ))}

          {marquee && (
            <div
              className="block-selection-marquee"
              style={{
                left: marquee.left,
                top: marquee.top,
                width: marquee.width,
                height: marquee.height,
              }}
            />
          )}
        </div>

        <div className="page-footer">
          <button onClick={() => addPage(page.id)} className="add-subpage-btn">+ Add sub-page</button>
        </div>
      </div>

      {formatBar && (() => {
        const block = blocks.find((b) => b.id === formatBar.blockId);
        if (!block) return null;
        const barWidth = 348;
        const barLeft = Math.max(8, Math.min(
          formatBar.rect.left + formatBar.rect.width / 2 - barWidth / 2,
          window.innerWidth - barWidth - 8
        ));
        const barTop = Math.max(8, formatBar.rect.top - 48);
        const cur = block.type;
        const curLevel = block.level;
        const btn = (label, active, onClick, title) => (
          <button
            key={label}
            title={title}
            className={`fmt-bar-btn${active ? " active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
          >{label}</button>
        );
        const execFmt = (cmd) => { document.execCommand(cmd); };
        return (
          <div className="fmt-bar" style={{ position:"fixed", left: barLeft, top: barTop, zIndex:9999, width: barWidth }}>
            {btn(<b>B</b>, false, () => execFmt("bold"),      "Bold (Ctrl+B)")}
            {btn(<i>I</i>, false, () => execFmt("italic"),    "Italic (Ctrl+I)")}
            {btn(<u>U</u>, false, () => execFmt("underline"), "Underline (Ctrl+U)")}
            <span className="fmt-bar-sep" />
            {btn("Text", cur === "text",                        () => convertBlockType(formatBar.blockId, "text"),      "Convert to text")}
            {btn("H1",   cur === "heading" && curLevel === 1,   () => convertBlockType(formatBar.blockId, "heading", 1), "Heading 1")}
            {btn("H2",   cur === "heading" && curLevel === 2,   () => convertBlockType(formatBar.blockId, "heading", 2), "Heading 2")}
            {btn("H3",   cur === "heading" && curLevel === 3,   () => convertBlockType(formatBar.blockId, "heading", 3), "Heading 3")}
            {btn("•",    cur === "bullets",                     () => convertBlockType(formatBar.blockId, "bullets"),   "Bullet list")}
            {btn("1.",   cur === "numbers",                     () => convertBlockType(formatBar.blockId, "numbers"),   "Numbered list")}
          </div>
        );
      })()}

      {slash && (
        <window.SlashMenu
          query={slash.query}
          onPick={pickSlash}
          onClose={hideSlash}
          anchorRect={slash.rect}
        />
      )}
    </main>
  );
}

function TaskIndexPage({ data, setCurrentPage, updatePage }) {
  const today = new Date().toISOString().slice(0, 10);
  const dueBucket = (task) => {
    if (task.done) return "Done";
    if (!task.dueDate) return "No due date";
    if (task.dueDate < today) return "Overdue";
    if (task.dueDate === today) return "Today";
    return "Upcoming";
  };
  const dueBucketRank = { Overdue: 0, Today: 1, Upcoming: 2, "No due date": 3, Done: 4 };

  const tasks = useMemo(() => {
    const rows = [];
    Object.values(data.pages || {}).forEach((page) => {
      if (!page || page.system || page.id === TASK_INDEX_PAGE_ID) return;
      (page.blocks || []).forEach((block) => {
        if (block.type !== "checklist") return;
        (block.items || []).forEach((item) => {
          const text = window.stripHtml ? window.stripHtml(item.text) : item.text;
          if (!text.trim()) return;
          rows.push({
            id: `${page.id}-${block.id}-${item.id}`,
            pageId: page.id,
            blockId: block.id,
            itemId: item.id,
            pageTitle: window.stripHtml ? window.stripHtml(page.title) : page.title,
            text,
            dueDate: item.dueDate || "",
            done: !!item.done,
          });
        });
      });
    });
    return rows;
  }, [data]);

  const grouped = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const key = dueBucket(task);
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const categories = Object.keys(grouped).sort((a, b) => (dueBucketRank[a] ?? 99) - (dueBucketRank[b] ?? 99));
  const toggleTask = (task) => {
    const page = data.pages[task.pageId];
    if (!page) return;
    updatePage(task.pageId, {
      blocks: (page.blocks || []).map((block) => {
        if (block.id !== task.blockId || block.type !== "checklist") return block;
        return {
          ...block,
          items: (block.items || []).map((item) => (
            item.id === task.itemId ? { ...item, done: !item.done } : item
          )),
        };
      }),
    });
  };
  const updateTaskDueDate = (task, dueDate) => {
    const page = data.pages[task.pageId];
    if (!page) return;
    updatePage(task.pageId, {
      blocks: (page.blocks || []).map((block) => {
        if (block.id !== task.blockId || block.type !== "checklist") return block;
        return {
          ...block,
          items: (block.items || []).map((item) => (
            item.id === task.itemId ? { ...item, dueDate } : item
          )),
        };
      }),
    });
  };

  return (
    <main className="page-main">
      <div className="page-container" key="task-index">
        <div className="page-header">
          <div style={{ fontSize:54, lineHeight:1, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:40, fontWeight:700, color:"var(--text-strong)", lineHeight:1.18, margin:"6px 0 30px" }}>
            Tasks by Due Date
          </div>
        </div>

        <div className="task-index">
          {categories.length === 0 ? (
            <div className="editable" style={{ color:"var(--text-muted)", fontSize:16 }}>No tasks yet.</div>
          ) : categories.map((category) => {
            const catStyle = window.categoryStyle?.(category) || { text:"var(--text-muted)" };
            return (
              <section key={category} className="task-category-group">
                <div className="task-category-title" style={{ color: catStyle.text }}>
                  {category} · {grouped[category].length}
                </div>
                {grouped[category].map((task) => (
                  <div
                    key={task.id}
                    className={`task-index-row ${task.done ? "done" : ""}`}
                    title={`Open ${task.pageTitle}`}
                  >
                    <button
                      className="task-index-dot"
                      onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                      title={task.done ? "Mark incomplete" : "Mark complete"}
                      type="button"
                    >
                      {task.done ? "✓" : ""}
                    </button>
                    <span className="task-index-title" style={{ textDecoration: task.done ? "line-through" : "none" }}>
                      {task.text}
                    </span>
                    <input
                      className="task-category-select task-index-category"
                      type="date"
                      value={task.dueDate || ""}
                      onChange={(e) => updateTaskDueDate(task, e.target.value)}
                      title="Change due date"
                    />
                    <button className="task-index-source" onClick={() => setCurrentPage(task.pageId)} type="button">{task.pageTitle}</button>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// ====== TABLE OF CONTENTS (right sidebar) ======
function TableOfContents({ page, collapsed, onToggle }) {
  if (!page) return null;
  const headings = (page.blocks || []).filter(b => b.type === "heading");

  const stripHtml = (s) => (s || "").replace(/<[^>]+>/g, "").trim();

  const scrollTo = (id) => {
    const el = document.querySelector(`[data-block-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (collapsed) {
    return (
      <aside className="toc collapsed">
        <button className="toc-toggle" onClick={onToggle} title="Show headings" type="button">☰</button>
      </aside>
    );
  }

  return (
    <aside className="toc">
      <div className="toc-header">
        <div className="toc-title">ON THIS PAGE</div>
        <button className="toc-toggle" onClick={onToggle} title="Hide headings" type="button">×</button>
      </div>
      {headings.length === 0 ? (
        <div className="toc-empty">No headings yet</div>
      ) : (
        <div className="toc-list">
          {headings.map(h => (
            <button
              key={h.id}
              onClick={() => scrollTo(h.id)}
              className={`toc-item toc-l${h.level}`}
              title={stripHtml(h.text)}
            >
              {stripHtml(h.text) || `Heading ${h.level}`}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
