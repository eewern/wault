// === Main workspace app ===
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const STORAGE_KEY = "workspace_v4_dark";
const TEMPLATES_KEY = "workspace_v4_templates";
const LOCAL_WORKSPACES_KEY = "workspace_v4_workspaces";
const LOCAL_ACTIVE_WORKSPACE_KEY = "workspace_v4_active_workspace";
const LOCAL_LAST_PAGE_PREFIX = "workspace_v4_last_page_";
const LOCAL_WORKSPACE_DATA_PREFIX = "workspace_v4_data_";
const LOCAL_PENDING_WORKSPACE_PREFIX = "workspace_v4_pending_";
const LOCAL_FIREBASE_REV_PREFIX = "workspace_v4_firebase_rev_";
// Tombstone of deleted workspace ids. Workspaces come back otherwise: seeds are
// re-added by initializeLocalWorkspaces, and the server discovery merge re-adds
// from Firebase. Both must honour this set so a delete actually sticks.
const LOCAL_DELETED_WORKSPACES_KEY = "workspace_v4_deleted";
const getDeletedWorkspaceIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem(LOCAL_DELETED_WORKSPACES_KEY) || "[]")); }
  catch { return new Set(); }
};
const isWorkspaceTombstoned = (id) => getDeletedWorkspaceIds().has(id);
const tombstoneWorkspace = (id) => {
  if (!id) return;
  const set = getDeletedWorkspaceIds();
  set.add(id);
  try { localStorage.setItem(LOCAL_DELETED_WORKSPACES_KEY, JSON.stringify([...set])); } catch {}
};
// If a workspace with this id is intentionally re-created/restored, clear its tombstone.
const untombstoneWorkspace = (id) => {
  const set = getDeletedWorkspaceIds();
  if (!set.delete(id)) return;
  try { localStorage.setItem(LOCAL_DELETED_WORKSPACES_KEY, JSON.stringify([...set])); } catch {}
};
const DEFAULT_LOCAL_WORKSPACE_ID = "local_default";
const TASK_INDEX_PAGE_ID = "task_index";
const HOME_PAGE_ID = "wault_home"; // Focus dashboard rendered as the in-app Home view
const LOCAL_BACKUP_INTERVAL_MS = 5000;
const LOCAL_BACKUP_LIMIT = 10;
const INDEXED_BACKUP_INTERVAL_MS = 1000;
const INDEXED_BACKUP_LIMIT = 200;
const INDEXED_BACKUP_DB = "wault_workspace_safety_v1";
const INDEXED_BACKUP_STORE = "snapshots";
const FIREBASE_DRAFT_SAVE_DELAY_MS = 100;
const FIREBASE_CANONICAL_SAVE_DELAY_MS = 200;
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
  pages: {},
  rootOrder: [],
  childOrder: {},
  currentPageId: null,
  _isNewBlankWorkspace: true,  // Skip template injection, start with one blank Home page
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
const localWorkspaceDataKey = (id) => `${LOCAL_WORKSPACE_DATA_PREFIX}${id}`;
const localLastPageKey = (id) => `${LOCAL_LAST_PAGE_PREFIX}${id}`;
const localPendingWorkspaceKey = (id) => `${LOCAL_PENDING_WORKSPACE_PREFIX}${id}`;
const localFirebaseRevisionKey = (id) => `${LOCAL_FIREBASE_REV_PREFIX}${id}`;
const rememberLocalPage = (workspaceId, pageId) => {
  if (!workspaceId || !pageId) return;
  try { localStorage.setItem(localLastPageKey(workspaceId), pageId); } catch {}
};
const restoreRememberedPage = (workspaceId, data) => {
  if (!workspaceId || !data?.pages) return data;
  try {
    const pageId = localStorage.getItem(localLastPageKey(workspaceId));
    if (pageId && data.pages[pageId]) data.currentPageId = pageId;
  } catch {}
  return data;
};
const createWorkspaceId = () => `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const createCloudWorkspaceId = () => `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const PAGE_EMOJIS = ["📄", "📝", "💡", "📌", "🗂️", "📊", "🧭", "🚀", "✨", "🔖", "🧠", "🛠️"];
// New pages get a clean premium line-icon (not a colour emoji). Falls back to a doc icon.
const randomPageIcon = () => {
  const keys = (window.PREMIUM_DEFAULT_KEYS && window.PREMIUM_DEFAULT_KEYS.length)
    ? window.PREMIUM_DEFAULT_KEYS : ["doc"];
  return keys[Math.floor(Math.random() * keys.length)];
};
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
// Home lives in `pages` ONLY (never rootOrder) so it routes + persists without
// ever appearing in the sidebar tree, drag targets, or context menus. The one
// nav entry is the ◎ Home button in the account panel.
const homePage = () => ({
  id: HOME_PAGE_ID,
  parentId: null,
  title: "Home",
  icon: "◎",
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

const ensureParentSubpageLinks = (data) => {
  if (!data || !data.pages) return data;
  const pages = { ...data.pages };
  let changed = false;

  const expectedParent = new Map();
  Object.values(pages).forEach((child) => {
    if (!child?.id || !child.parentId) return;
    const parent = pages[child.parentId];
    if (!parent || parent.system) return;
    expectedParent.set(child.id, child.parentId);
  });

  Object.entries(pages).forEach(([pageId, page]) => {
    if (!Array.isArray(page?.blocks)) return;
    const seenSubpageLinks = new Set();
    const blocks = page.blocks.filter((block) => {
      if (block?.type !== "subpage") return true;
      if (!(block.pageId && pages[block.pageId] && expectedParent.get(block.pageId) === pageId)) return false;
      if (seenSubpageLinks.has(block.pageId)) return false;
      seenSubpageLinks.add(block.pageId);
      return true;
    });
    if (blocks.length !== page.blocks.length) {
      pages[pageId] = { ...page, blocks: page.system ? blocks : ensureTrailingTextBlock(blocks) };
      changed = true;
    }
  });

  expectedParent.forEach((parentId, childId) => {
    const parent = pages[parentId];
    if (!parent || parent.system) return;
    const blocks = Array.isArray(parent.blocks) ? [...parent.blocks] : [];
    if (blocks.some((block) => block.type === "subpage" && block.pageId === childId)) return;
    const linkBlock = { id: `sub_${childId}`, type: "subpage", pageId: childId };
    const last = blocks[blocks.length - 1];
    if (isBlankTextBlock(last)) blocks.splice(blocks.length - 1, 0, linkBlock);
    else blocks.push(linkBlock);
    pages[parentId] = { ...parent, blocks };
    changed = true;
  });

  return changed ? { ...data, pages } : data;
};

function normalizeWorkspaceData(raw) {
  // Brand-new workspace: skip all template injection, start with one blank Home page
  if (raw?._isNewBlankWorkspace) {
    const homeId = 'start_' + Date.now().toString(36);
    return {
      pages: {
        [HOME_PAGE_ID]: homePage(),
        [homeId]: { id: homeId, title: 'Getting Started', icon: '🏠', blocks: [], parentId: null },
      },
      rootOrder: [homeId],
      childOrder: {},
      pinnedPages: [],
      settings: {},
      events: {},
      currentPageId: homeId,
    };
  }
  const data = raw && raw.pages ? raw : cloneDefaultWorkspace();
  const pages = { ...data.pages };
  let rootOrder = [...(data.rootOrder || [])];
  const shouldRefreshSeedContent = data.seedRefreshVersion !== SEED_REFRESH_VERSION;

  if (!pages[TASK_INDEX_PAGE_ID]) {
    pages[TASK_INDEX_PAGE_ID] = taskIndexPage();
  } else {
    pages[TASK_INDEX_PAGE_ID] = { ...pages[TASK_INDEX_PAGE_ID], title: "Tasks by Due Date", icon: "✅", parentId: null, system: true, blocks: [] };
  }

  // Home (Focus dashboard) system page: pages map only — keep it OUT of rootOrder.
  if (!pages[HOME_PAGE_ID]) {
    pages[HOME_PAGE_ID] = homePage();
  } else {
    pages[HOME_PAGE_ID] = { ...pages[HOME_PAGE_ID], title: "Home", icon: "◎", parentId: null, system: true, blocks: [] };
  }
  rootOrder = rootOrder.filter((id) => id !== HOME_PAGE_ID);
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

  const normalized = ensureParentSubpageLinks(cleanupRetiredChurnsWeek1DayPages({ ...data, pages, rootOrder, childOrder, currentPageId, seedRefreshVersion: SEED_REFRESH_VERSION }));
  if (!normalized.pages[normalized.currentPageId]) {
    normalized.currentPageId = normalized.rootOrder.find((id) => normalized.pages[id]) || Object.keys(normalized.pages)[0];
  }
  // Ensure pinnedPages array exists and only contains valid page IDs
  if (!Array.isArray(normalized.pinnedPages)) normalized.pinnedPages = [];
  normalized.pinnedPages = normalized.pinnedPages.filter(id => !!normalized.pages[id]);
  // Ensure workspace settings object exists
  if (!normalized.settings || typeof normalized.settings !== 'object') normalized.settings = {};
  // Calendar events live on the workspace: { [id]: { id, title, date, time?, notes?, pageId? } }
  if (!normalized.events || typeof normalized.events !== 'object' || Array.isArray(normalized.events)) normalized.events = {};
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

function firebaseSaveSucceeded(result) {
  return !!(result && result.ok !== false);
}

function firebaseSaveFailureMessage(result, fallback = "Cloud save failed") {
  if (result?.reason === "dangerous_overwrite") return "Save blocked: local data looked empty/stale and could overwrite Firebase.";
  if (result?.reason === "stale_revision") return "Save blocked: Firebase has a newer revision.";
  return fallback;
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
  if (Array.isArray(workspaces)) {
    const filtered = workspaces.filter((workspace) => workspace?.id && !isWorkspaceTombstoned(workspace.id));
    if (filtered.length !== workspaces.length) {
      workspaces = filtered;
      localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(workspaces));
    }
  }
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    const legacy = readJson(STORAGE_KEY, null);
    // Honour tombstones; but never end up with zero workspaces.
    let seeds = workspaceSeeds().filter((seed, index) => !isWorkspaceTombstoned(seed.id || `${DEFAULT_LOCAL_WORKSPACE_ID}_${index}`));
    if (!seeds.length) seeds = workspaceSeeds().slice(0, 1);
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
      if (isWorkspaceTombstoned(id)) return; // user deleted this seed — don't resurrect it
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
  if (stored) return restoreRememberedPage(workspaceId, normalizeWorkspaceData(stored));
  // Use the workspace-specific seed so churns gets churns data, xalt gets xalt data
  const seed = workspaceSeeds().find(s => s.id === workspaceId || s.seedKey === workspaceId);
  const seedData = seed?.data ? JSON.parse(JSON.stringify(seed.data)) : cloneDefaultWorkspace();
  return restoreRememberedPage(workspaceId, normalizeWorkspaceData(seedData));
}

// Hybrid load: compare localStorage vs Firebase and pick the newer one
async function loadLocalWorkspaceDataWithFirebaseFallback(workspaceId) {
  // Load from localStorage (fast, synchronous)
  const localData = loadLocalWorkspaceData(workspaceId);
  const localStoredAt = readJson(`${workspaceId}_local_saved_at`, null);

  // Try to load from Firebase if available
  let firebaseData = null;
  let firebaseSavedAt = null;

  try {
    if (window.WorkspaceFirebaseSync?.loadWorkspace) {
      const firebaseResult = await window.WorkspaceFirebaseSync.loadWorkspace(workspaceId);
      if (firebaseResult?.workspace) {
        firebaseData = firebaseResult.workspace;
        firebaseSavedAt = firebaseResult.updated_at;
      }
    }
  } catch (err) {
    console.warn('⚠️ Firebase load failed, using localStorage:', err.message);
  }

  // Choose the newer one based on timestamps
  if (firebaseData && firebaseSavedAt && localStoredAt) {
    const firebaseTime = new Date(firebaseSavedAt).getTime();
    const localTime = new Date(localStoredAt).getTime();
    if (firebaseTime > localTime) {
      console.log('📡 Firebase data is newer, using cloud version');
      return normalizeWorkspaceData(firebaseData);
    }
  }

  // Default to localStorage if Firebase is older or unavailable
  return localData;
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

function normalizeWorkspaceSummary(workspace) {
  if (!workspace?.id) return null;
  return {
    id: workspace.id,
    name: String(workspace.name || workspace.id).trim() || workspace.id,
    visibility: workspace.visibility === "private" ? "private" : "shared",
    ownerUid: workspace.ownerUid || "",
    ownerEmail: workspace.ownerEmail || "",
    updatedAt: workspace.updatedAt || new Date().toISOString(),
    createdAt: workspace.createdAt || "",
    pageCount: Number(workspace.pageCount || 0),
    currentPageId: workspace.currentPageId || null,
  };
}

function replaceSignedInWorkspaceCatalogue(discovered) {
  const deletedIds = new Set(discovered?.deletedWorkspaceIds || []);
  deletedIds.forEach((id) => tombstoneWorkspace(id));
  const tombstoned = getDeletedWorkspaceIds();
  const list = (Array.isArray(discovered) ? discovered : [])
    .map(normalizeWorkspaceSummary)
    .filter((workspace) => workspace && !tombstoned.has(workspace.id) && !deletedIds.has(workspace.id));
  localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(list));
  return list;
}

// Live-catalogue merge: the Firebase /workspaceCatalog snapshot is authoritative
// for which workspaces exist (deleted ones are filtered out), but a just-created
// workspace can briefly be absent from the snapshot. Preserve the currently-active
// workspace so a switch/create race never kicks the user out of it.
function mergeSignedInWorkspaceCatalogue(discovered, activeId) {
  const deletedIds = new Set(discovered?.deletedWorkspaceIds || []);
  deletedIds.forEach((id) => tombstoneWorkspace(id));
  const tombstoned = getDeletedWorkspaceIds();
  const list = (Array.isArray(discovered) ? discovered : [])
    .map(normalizeWorkspaceSummary)
    .filter((workspace) => workspace && !tombstoned.has(workspace.id) && !deletedIds.has(workspace.id));
  // An empty snapshot is almost always a transient/permission error (you can't
  // delete your last workspace), so never let it wipe the dropdown — keep the
  // cached list instead.
  if (!list.length) {
    const cached = (readJson(LOCAL_WORKSPACES_KEY, []) || [])
      .map(normalizeWorkspaceSummary)
      .filter((workspace) => workspace && !tombstoned.has(workspace.id) && !deletedIds.has(workspace.id));
    if (cached.length) return cached;
  }
  if (activeId && !tombstoned.has(activeId) && !deletedIds.has(activeId) && !list.some((w) => w.id === activeId)) {
    const localActive = (readJson(LOCAL_WORKSPACES_KEY, []) || []).find((w) => w?.id === activeId);
    const normalized = localActive ? normalizeWorkspaceSummary(localActive) : null;
    if (normalized) list.push(normalized);
  }
  localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(list));
  return list;
}

function createWorkspaceUnavailableData(workspaceName = "Workspace unavailable", reason = "This workspace could not be loaded from Firebase.") {
  const pageId = "cloud_workspace_unavailable";
  return normalizeWorkspaceData({
    pages: {
      [pageId]: {
        id: pageId,
        parentId: null,
        title: workspaceName,
        icon: "⚠️",
        blocks: [
          {
            id: "cloud_workspace_unavailable_message",
            type: "text",
            text: `<b>Workspace unavailable.</b> ${reason}`,
          },
        ],
      },
    },
    rootOrder: [pageId],
    childOrder: {},
    pinnedPages: [],
    settings: {},
    events: {},
    currentPageId: pageId,
  });
}

function isWorkspaceUnavailableData(data) {
  return !!data?.pages?.cloud_workspace_unavailable;
}

function inferWorkspaceNameFromData(id, data, fallback = "") {
  const clean = (value) => String(value || "").replace(/<[^>]*>/g, "").trim();
  const pages = data?.pages || {};
  const explicit = clean(fallback || data?.settings?.workspaceName);
  if (explicit) return explicit;
  const searchable = JSON.stringify({
    id,
    pageIds: Object.keys(pages).slice(0, 80),
    titles: Object.values(pages).slice(0, 80).map((page) => clean(page?.title)),
  }).toLowerCase();
  if (searchable.includes("xalt")) return "XALT";
  if (searchable.includes("churns")) return "Churns AI Bible";
  const rootTitle = (data?.rootOrder || [])
    .map((pageId) => clean(pages?.[pageId]?.title))
    .find(Boolean);
  return rootTitle || id || "Imported workspace";
}

function discoverLocalWorkspaceDrafts(remoteList = []) {
  const remoteIds = new Set((remoteList || []).map((workspace) => workspace?.id).filter(Boolean));
  const localList = readJson(LOCAL_WORKSPACES_KEY, []) || [];
  const localMetaById = new Map(localList.filter((w) => w?.id).map((w) => [w.id, w]));
  const drafts = [];
  const seen = new Set();
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LOCAL_WORKSPACE_DATA_PREFIX)) continue;
      const id = key.slice(LOCAL_WORKSPACE_DATA_PREFIX.length);
      if (!id || remoteIds.has(id) || seen.has(id) || isWorkspaceTombstoned(id)) continue;
      seen.add(id);
      const raw = readJson(key, null);
      if (!raw?.pages || isWorkspaceUnavailableData(raw)) continue;
      const pageCount = Object.keys(raw.pages || {}).filter((pageId) => pageId !== HOME_PAGE_ID && pageId !== TASK_INDEX_PAGE_ID).length;
      if (pageCount <= 0) continue;
      const meta = localMetaById.get(id) || {};
      drafts.push({
        id,
        name: inferWorkspaceNameFromData(id, raw, meta.name),
        visibility: meta.visibility === "private" ? "private" : "shared",
        ownerUid: meta.ownerUid || "",
        ownerEmail: meta.ownerEmail || "",
        updatedAt: meta.updatedAt || new Date().toISOString(),
        data: normalizeWorkspaceData(raw),
      });
    }
  } catch (err) {
    console.warn("⚠️ Local workspace draft scan failed:", err.message);
  }
  return drafts;
}

// Merge workspaces DISCOVERED from the server (Firebase, via the API) into the
// per-browser local list, so workspaces created on another device / by Claude
// show up in the switcher here.
// - ADDS workspaces that exist in Firebase but not locally.
// - REMOVES workspaces that no longer exist in Firebase (deleted on another device).
//   Only removes if Firebase returned a non-empty list (guards against network errors
//   wiping the local list). Never removes locally-tombstoned workspaces (already gone).
// Returns the merged array, or null if nothing changed.
function mergeDiscoveredWorkspaces(discovered, { pruneMissing = false, deletedIds = [] } = {}) {
  discovered = Array.isArray(discovered) ? discovered : [];
  if (!discovered.length && !(deletedIds || []).length) return null;
  const workspaces = readJson(LOCAL_WORKSPACES_KEY, []);
  const remoteIds = new Set(discovered.map((w) => w.id).filter(Boolean));
  const deleted = new Set([...getDeletedWorkspaceIds(), ...(deletedIds || [])]);
  deleted.forEach((id) => tombstoneWorkspace(id));

  // Firebase user catalogue is authoritative for this Google account; API
  // discovery is additive only because newly-created browser workspaces may not
  // have reached the server catalogue yet.
  const current = (workspaces || []).filter((w) => w?.id && !deleted.has(w.id));
  const kept = pruneMissing ? current.filter((w) => remoteIds.has(w.id)) : current;

  // Add workspaces that Firebase knows about but this browser doesn't have yet
  const keptIds = new Set(kept.map((w) => w.id));
  const additions = discovered
    .filter((w) => w && w.id && !keptIds.has(w.id) && !deleted.has(w.id))
    .map((w) => normalizeWorkspaceSummary(w))
    .filter(Boolean);

  const next = [...kept, ...additions];
  const changed = next.length !== (workspaces || []).length || additions.length > 0;
  if (!changed) return null;
  localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(next));
  return next;
}

function localBackupKey(workspaceId) {
  return `workspace_v4_backups_${workspaceId}`;
}

let indexedBackupDbPromise = null;
const indexedBackupLastWrite = {};

function openIndexedBackupDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  if (indexedBackupDbPromise) return indexedBackupDbPromise;
  indexedBackupDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(INDEXED_BACKUP_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_BACKUP_STORE)) {
        const store = db.createObjectStore(INDEXED_BACKUP_STORE, { keyPath: "id" });
        store.createIndex("workspaceId", "workspaceId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return indexedBackupDbPromise;
}

async function readIndexedWorkspaceBackups(workspaceId) {
  if (!workspaceId) return [];
  const db = await openIndexedBackupDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(INDEXED_BACKUP_STORE, "readonly");
    const store = tx.objectStore(INDEXED_BACKUP_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const rows = (request.result || [])
        .filter((row) => row?.workspaceId === workspaceId && row?.data?.pages)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      resolve(rows);
    };
    request.onerror = () => resolve([]);
  });
}

async function readLatestIndexedWorkspaceBackup(workspaceId) {
  const rows = await readIndexedWorkspaceBackups(workspaceId);
  return rows[0] || null;
}

async function pruneIndexedWorkspaceBackups(workspaceId) {
  const rows = await readIndexedWorkspaceBackups(workspaceId);
  const extras = rows.slice(INDEXED_BACKUP_LIMIT);
  if (!extras.length) return;
  const db = await openIndexedBackupDb();
  if (!db) return;
  const tx = db.transaction(INDEXED_BACKUP_STORE, "readwrite");
  const store = tx.objectStore(INDEXED_BACKUP_STORE);
  extras.forEach((row) => { try { store.delete(row.id); } catch {} });
}

async function writeIndexedWorkspaceBackup(workspaceId, data, reason = "autosave", baseUpdatedAt = "") {
  if (!workspaceId || !data?.pages || isWorkspaceUnavailableData(data)) return null;
  const nowMs = Date.now();
  if (indexedBackupLastWrite[workspaceId] && nowMs - indexedBackupLastWrite[workspaceId] < INDEXED_BACKUP_INTERVAL_MS) return null;
  const db = await openIndexedBackupDb();
  if (!db) return null;
  indexedBackupLastWrite[workspaceId] = nowMs;
  const snapshot = {
    id: `${workspaceId}:${nowMs}`,
    workspaceId,
    reason,
    createdAt: new Date(nowMs).toISOString(),
    baseUpdatedAt: baseUpdatedAt || "",
    data,
  };
  return new Promise((resolve) => {
    const tx = db.transaction(INDEXED_BACKUP_STORE, "readwrite");
    tx.objectStore(INDEXED_BACKUP_STORE).put(snapshot);
    tx.oncomplete = () => {
      pruneIndexedWorkspaceBackups(workspaceId).catch(() => {});
      resolve(snapshot);
    };
    tx.onerror = () => resolve(null);
  });
}

function cleanupLocalWorkspaceArtifacts(workspaceId) {
  if (!workspaceId) return;
  try {
    localStorage.removeItem(localWorkspaceDataKey(workspaceId));
    localStorage.removeItem(localBackupKey(workspaceId));
    localStorage.removeItem(localLastPageKey(workspaceId));
    localStorage.removeItem(localPendingWorkspaceKey(workspaceId));
    localStorage.removeItem(localFirebaseRevisionKey(workspaceId));
    localStorage.removeItem(`${workspaceId}_local_saved_at`);
  } catch {}
}

function readPendingWorkspaceDraft(workspaceId) {
  if (!workspaceId) return null;
  const draft = readJson(localPendingWorkspaceKey(workspaceId), null);
  if (!draft?.data?.pages || draft.workspaceId !== workspaceId) return null;
  return draft;
}

function writePendingWorkspaceDraft(workspaceId, data, baseUpdatedAt = "") {
  if (!workspaceId || !data?.pages || isWorkspaceUnavailableData(data)) return null;
  const draft = {
    workspaceId,
    data,
    baseUpdatedAt: baseUpdatedAt || "",
    savedAt: new Date().toISOString(),
  };
  try { localStorage.setItem(localPendingWorkspaceKey(workspaceId), JSON.stringify(draft)); } catch {}
  return draft;
}

function clearPendingWorkspaceDraft(workspaceId) {
  if (!workspaceId) return;
  try { localStorage.removeItem(localPendingWorkspaceKey(workspaceId)); } catch {}
}

function shouldReplayPendingDraft(pending, remoteUpdatedAt = "") {
  if (!pending?.data?.pages || !pending.savedAt) return false;
  const pendingMs = Date.parse(pending.savedAt) || 0;
  const remoteMs = Date.parse(remoteUpdatedAt || "") || 0;
  const baseMs = Date.parse(pending.baseUpdatedAt || "") || 0;
  if (pendingMs <= remoteMs) return false;
  if (!remoteMs) return true;
  return !!baseMs && remoteMs <= baseMs;
}

function normalizeCloudWorkspaceDraft(workspaceId, draft) {
  if (!workspaceId || !draft?.workspace?.pages || !draft.saved_at) return null;
  return {
    workspaceId,
    data: draft.workspace,
    baseUpdatedAt: draft.base_updated_at || "",
    savedAt: draft.saved_at,
    source: "firebase-draft",
  };
}

function normalizeIndexedWorkspaceBackup(workspaceId, backup) {
  if (!workspaceId || !backup?.data?.pages || !backup.createdAt) return null;
  return {
    workspaceId,
    data: backup.data,
    baseUpdatedAt: backup.baseUpdatedAt || "",
    savedAt: backup.createdAt,
    source: "indexed-backup",
  };
}

function newestReplayableDraft(remoteUpdatedAt, ...drafts) {
  return drafts
    .filter((draft) => draft && shouldReplayPendingDraft(draft, remoteUpdatedAt))
    .sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0))[0] || null;
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

function persistWorkspaceLocallyNow(workspaceId, data, reason = "instant-local-save", baseUpdatedAt = "") {
  if (!workspaceId || !data?.pages || isWorkspaceUnavailableData(data)) return { workspaces: null, backup: null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(`${workspaceId}_local_saved_at`, new Date().toISOString());
  const workspaces = saveLocalWorkspaceData(workspaceId, data);
  const backup = writeLocalAutoBackup(workspaceId, data, reason);
  writeIndexedWorkspaceBackup(workspaceId, data, reason, baseUpdatedAt).catch(() => {});
  return { workspaces, backup };
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

// ====== GOOGLE SIGN-IN SCREEN ======
function GoogleSignInScreen({ busy, error, onSignIn }) {
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <div className="auth-kicker">Workspace</div>
        <h1>Sign in to continue</h1>
        <p>This workspace is invite-only. Sign in with your Google account to access it.</p>
        <button
          className="auth-btn google-btn"
          disabled={busy}
          onClick={onSignIn}
          style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
      </section>
    </main>
  );
}

// ====== FIREBASE ACCESS DENIED SCREEN ======
function FirebaseAccessDeniedScreen({ email, onSignOut }) {
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <div className="auth-kicker">Waiting for approval</div>
        <h1>Request sent</h1>
        <p>
          <strong>{email}</strong> is signed in, and your request is now visible to the
          workspace owner. You'll get access as soon as they approve you. Just refresh
          this page after that.
        </p>
        <button className="auth-btn secondary" onClick={onSignOut}>Sign in with a different account</button>
      </section>
    </main>
  );
}

function PrivateWorkspaceScreen({ email, onSignOut }) {
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 14 }}>
          <rect x="4.5" y="9" width="11" height="8" rx="1.8" />
          <path d="M6.5 9V6.2a3.5 3.5 0 0 1 7 0V9" />
        </svg>
        <div className="auth-kicker">Private workspace</div>
        <h1>Access restricted</h1>
        <p>This workspace has been made <strong>private</strong> by the owner. Only the owner can access it right now.</p>
        <div className="auth-note">Signed in as {email}</div>
        <button className="auth-btn secondary" onClick={onSignOut}>Sign out</button>
      </section>
    </main>
  );
}

// ── Team helpers — defined at module level so React never remounts them ──────
function memberColor(email) {
  if (!email) return 'hsl(0,0%,53%)';
  let h = 0;
  for (let i = 0; i < email.length; i++) h = ((h << 5) - h) + email.charCodeAt(i);
  return 'hsl(' + (Math.abs(h) % 360) + ', 65%, 52%)';
}

// Avatar with React-state photo fallback (no direct DOM mutation that would break reconciliation)
function TeamAvatar({ email, name, photoURL, size }) {
  size = size || 22;
  const [imgFailed, setImgFailed] = React.useState(false);
  const letter = ((name || email || '?').trim()[0] || '?').toUpperCase();
  const bg = memberColor(email);
  const circleStyle = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: bg, color: '#fff', fontWeight: 700,
    fontSize: Math.round(size * 0.46), lineHeight: 1, userSelect: 'none',
    border: '2px solid rgba(var(--ovr),0.12)',
  };
  if (photoURL && !imgFailed) {
    return (
      <img
        src={photoURL}
        alt={letter}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', display: 'block', border: '2px solid rgba(var(--ovr),0.12)', flexShrink: 0 }}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return <span style={circleStyle}>{letter}</span>;
}

// ====== TEAM PANEL (compact sidebar strip) + TEAM MODAL (popup overlay) ======
function TeamPanel({ authUser, userAccess, onSignOut, activeWorkspaceId, exportData, importData, syncState, onOpenHome, homeActive }) {
  const [showModal, setShowModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState('data');
  // Theme: 'dark' (default) | 'light' (white minimalist, grid-note) | 'red' (red nude)
  const [theme, setThemeState] = React.useState(() => {
    try { return localStorage.getItem('wn_theme') || 'dark'; } catch { return 'dark'; }
  });
  const applyTheme = (t) => {
    if (!['dark','light','red'].includes(t)) t = 'dark';
    try { localStorage.setItem('wn_theme', t); } catch {}
    document.documentElement.setAttribute('data-theme', t);
    setThemeState(t);
  };
  const [members, setMembers] = React.useState([]);
  const [pending, setPending] = React.useState([]);
  const [blocked, setBlocked] = React.useState([]);
  const [busy, setBusy] = React.useState(false); // uid string when one row is busy, false otherwise
  const [msg, setMsg] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [listLoaded, setListLoaded] = React.useState(false);
  // ── API Key state ──────────────────────────────────────────────────────────
  const [apiKey, setApiKey] = React.useState(null);      // null = not loaded, '' = none, 'wn_...' = has key
  const [apiKeyVisible, setApiKeyVisible] = React.useState(false);
  const [apiKeyCopied, setApiKeyCopied] = React.useState(false);
  const [apiKeyBusy, setApiKeyBusy] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState('');
  const [feedbackBusy, setFeedbackBusy] = React.useState(false);
  const [feedbackMsg, setFeedbackMsg] = React.useState('');

  const loadApiKey = React.useCallback(async () => {
    try { setApiKey(await window.WorkspaceFirebaseSync?.getApiKey?.() || ''); } catch { setApiKey(''); }
  }, []);

  React.useEffect(() => { if (showSettingsModal && settingsTab === 'mcp' && apiKey === null) loadApiKey(); }, [showSettingsModal, settingsTab, apiKey, loadApiKey]);

  const handleGenerateKey = async () => {
    setApiKeyBusy(true);
    try { setApiKey(await window.WorkspaceFirebaseSync.generateApiKey()); setApiKeyVisible(true); }
    catch (e) { alert('Failed: ' + e.message); }
    finally { setApiKeyBusy(false); }
  };

  const handleRevokeKey = async () => {
    if (!confirm('Revoke this API key? Any Claude Code connections using it will stop working.')) return;
    setApiKeyBusy(true);
    try { await window.WorkspaceFirebaseSync.revokeApiKey(); setApiKey(''); setApiKeyVisible(false); }
    catch (e) { alert('Failed: ' + e.message); }
    finally { setApiKeyBusy(false); }
  };

  const copyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard?.writeText(apiKey).then(() => { setApiKeyCopied(true); setTimeout(() => setApiKeyCopied(false), 2000); });
  };

  const submitFeedback = async () => {
    const message = feedbackText.trim();
    if (!message) return;
    setFeedbackBusy(true);
    setFeedbackMsg('');
    try {
      await window.WorkspaceFirebaseSync?.submitFeedback?.(message, {
        workspaceId: activeWorkspaceId || '',
        page: window.location.href.split('#')[0],
      });
      setFeedbackText('');
      setFeedbackMsg('Feedback sent. Thank you.');
    } catch (err) {
      setFeedbackMsg(`Failed to send: ${err.message}`);
    } finally {
      setFeedbackBusy(false);
    }
  };
  // ── end API Key state ──────────────────────────────────────────────────────
  const [listErr, setListErr] = React.useState(false); // true if load timed-out / rules blocked
  const isOwner = userAccess?.role === 'owner';

  // Use module-level TeamAvatar (not a nested component) to avoid React remount on every render
  const Avatar = TeamAvatar;

  const refresh = React.useCallback(async () => {
    const sync = window.WorkspaceFirebaseSync;
    if (!isOwner || !sync?.getAccessList) return;
    setListLoaded(false); setListErr(false);
    try {
      const [list, pend, blk] = await Promise.all([
        sync.getAccessList(),
        sync.getPendingSignins ? sync.getPendingSignins() : Promise.resolve([]),
        sync.getBlockedUsers ? sync.getBlockedUsers() : Promise.resolve([]),
      ]);
      // Deduplicate by email — same person can accumulate multiple UIDs across devices/sign-ins.
      // If a duplicate is found, prefer the owner-role entry; otherwise keep the first seen.
      const seen = new Map();
      for (const m of (list || [])) {
        const key = (m.email || m.uid || '').toLowerCase();
        if (!seen.has(key) || m.role === 'owner') seen.set(key, m);
      }
      setMembers([...seen.values()]);
      setPending(pend || []);
      setBlocked(blk || []);
      setListLoaded(true);
    } catch (err) {
      setListErr(true);
      setListLoaded(true);
    }
  }, [isOwner]);

  // Refresh whenever the modal opens
  React.useEffect(() => { if (showModal && isOwner) refresh(); }, [showModal, refresh, isOwner]);

  const grant = async (uid, email) => {
    if (!uid || !window.WorkspaceFirebaseSync?.grantAccess) return;
    setBusy(uid); setMsg('');
    try {
      await window.WorkspaceFirebaseSync.grantAccess(uid, email, 'member');
      setMsg(`✅ ${email || 'User'} approved`);
      await refresh();
    } catch (err) { setMsg(`❌ ${err.message}`); }
    finally { setBusy(false); }
  };

  const revoke = async (uid, email) => {
    if (!uid || !window.WorkspaceFirebaseSync?.revokeAccess) return;
    if (uid === authUser?.uid) return;
    setBusy(uid); setMsg('');
    try {
      await window.WorkspaceFirebaseSync.revokeAccess(uid);
      await refresh();
      setMsg(`Removed ${email || 'user'}`);
    } catch (err) { setMsg(`❌ ${err.message}`); }
    finally { setBusy(false); }
  };

  // Reject a pending request — clears it from the queue (they can ask again later).
  const reject = async (uid, email) => {
    if (!uid || !window.WorkspaceFirebaseSync?.rejectSignin) return;
    setBusy(uid); setMsg('');
    try {
      await window.WorkspaceFirebaseSync.rejectSignin(uid);
      await refresh();
      setMsg(`Rejected ${email || 'request'}`);
    } catch (err) { setMsg(`❌ ${err.message}`); }
    finally { setBusy(false); }
  };

  // Block a user/email — removes access + pending and keeps them out until unblocked.
  const block = async (uid, email) => {
    if (!uid || !window.WorkspaceFirebaseSync?.blockUser) return;
    if (uid === authUser?.uid) return;
    if (!confirm(`Block ${email || 'this user'}? They won't be able to request access until you unblock them.`)) return;
    setBusy(uid); setMsg('');
    try {
      await window.WorkspaceFirebaseSync.blockUser(uid, email);
      await refresh();
      setMsg(`⛔ Blocked ${email || 'user'}`);
    } catch (err) { setMsg(`❌ ${err.message}`); }
    finally { setBusy(false); }
  };

  // Unblock — allows them to request access again.
  const unblock = async (uid, email) => {
    if (!uid || !window.WorkspaceFirebaseSync?.unblockUser) return;
    setBusy(uid); setMsg('');
    try {
      await window.WorkspaceFirebaseSync.unblockUser(uid);
      await refresh();
      setMsg(`Unblocked ${email || 'user'}`);
    } catch (err) { setMsg(`❌ ${err.message}`); }
    finally { setBusy(false); }
  };

  const copyLink = () => {
    const url = window.location.href.split('?')[0].split('#')[0];
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  };

  const sect = (label, badge) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
      {label}
      {badge != null && badge > 0 && (
        <span style={{ background: '#f5a623', color: '#000', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>{badge}</span>
      )}
    </div>
  );
  const browserApiUrl = (window.WORKSPACE_API_URL || window.location.origin || window.location.href.split(/[?#]/)[0].replace(/\/[^/]*$/, "")).replace(/\/$/, "");

  return (
    <>
      {/* ── Account / team strip ─────────────────────────────────────── */}
      <div className="account-strip">
        {/* Identity: avatar + name + role/sync */}
        <div className="account-identity">
          <Avatar email={authUser?.email} name={authUser?.displayName} photoURL={authUser?.photoURL} size={30} />
          <div className="account-meta">
            <div className="account-name" title={authUser?.email}>
              {authUser?.displayName || authUser?.email}
            </div>
            <div className="account-sub">
              <span style={{ textTransform: 'capitalize' }}>{userAccess?.role || 'member'}</span>
              {syncState && <SyncPanel syncState={syncState} />}
            </div>
          </div>
        </div>
        {/* Actions row — full width, no overflow */}
        <div className="account-actions">
          {isOwner && (
            <button
              onClick={() => { setMsg(''); setShowModal(true); }}
              data-tooltip={pending.length > 0 ? `${pending.length} pending request${pending.length > 1 ? 's' : ''}` : 'Manage team members'}
              className={`account-btn is-team has-tip tip-account ${pending.length > 0 ? 'has-pending' : ''}`}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {pending.length > 0 ? `Team (${pending.length})` : 'Team'}
            </button>
          )}
          <button
            onClick={() => { setFeedbackMsg(''); setSettingsTab('data'); setShowSettingsModal(true); }}
            data-tooltip="Settings"
            className="account-btn is-icon is-settings has-tip tip-account"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button
            onClick={onSignOut}
            data-tooltip="Sign out"
            className="account-btn is-icon has-tip tip-account"
            aria-label="Sign out"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* ── Team modal popup ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="team-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="team-modal-card">
            {/* Header */}
            <div className="team-modal-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Workspace Team</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Manage who can access this workspace</div>
              </div>
              <button className="team-modal-close" onClick={() => setShowModal(false)} title="Close" aria-label="Close">×</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* You */}
              <div>
                {sect('You')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(88,196,212,0.06)', border: '1px solid rgba(88,196,212,0.14)', borderRadius: 10, padding: '11px 14px' }}>
                  <Avatar email={authUser?.email} name={authUser?.displayName} photoURL={authUser?.photoURL} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {authUser?.displayName || authUser?.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authUser?.email}</div>
                  </div>
                  <span className="team-role-badge">{userAccess?.role || 'member'}</span>
                </div>
              </div>

              {/* Members list — owner only */}
              {isOwner && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    {sect(`Members${members.length > 0 ? ` (${members.length})` : ''}`)}
                    <button
                      onClick={refresh}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, marginTop: -10, flexShrink: 0 }}
                      title="Refresh list"
                    >↻ Refresh</button>
                  </div>
                  {!listLoaded ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Loading…</div>
                  ) : listErr ? (
                    <div style={{ fontSize: 12, color: '#f5a623', background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)', borderRadius: 8, padding: '10px 13px', lineHeight: 1.5 }}>
                      ⚠️ Could not load members. Deploy <strong>database.rules.json</strong> via Firebase Console, then click ↻ Refresh.
                    </div>
                  ) : members.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No members yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {members.map(m => (
                        <div key={m.uid} className="team-member-row">
                          <Avatar email={m.email} name={m.displayName} photoURL={m.photoURL} size={30} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>{m.role}</div>
                          </div>
                          {m.uid !== authUser?.uid && m.role !== 'owner' && (
                            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                              <button
                                onClick={() => revoke(m.uid, m.email)}
                                disabled={busy === m.uid}
                                className="team-remove-btn"
                              >
                                {busy === m.uid ? '…' : 'Remove'}
                              </button>
                              <button
                                onClick={() => block(m.uid, m.email)}
                                disabled={busy === m.uid}
                                className="team-remove-btn"
                                title="Block this user — removes access and stops future requests"
                                style={{ color: '#f07070', borderColor: 'rgba(240,112,112,0.35)' }}
                              >
                                Block
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pending requests — owner only */}
              {isOwner && (
                <div>
                  {sect('Pending Requests', pending.length)}
                  {pending.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(var(--ovr),0.02)', borderRadius: 9, padding: '13px 15px', lineHeight: 1.6 }}>
                      No pending requests. Share the workspace link below — teammates sign in with Google and appear here for you to approve.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {pending.map(p => (
                        <div key={p.uid} className="team-pending-row">
                          <Avatar email={p.email} name={p.displayName} photoURL={p.photoURL} size={30} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email || p.displayName || p.uid}</div>
                            <div style={{ fontSize: 10, color: '#f5a623', marginTop: 2 }}>Waiting for approval</div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            <button
                              onClick={() => grant(p.uid, p.email)}
                              disabled={busy === p.uid}
                              className="team-approve-btn"
                              title="Approve — grant access to the workspace"
                              style={{ opacity: busy === p.uid ? 0.6 : 1, cursor: busy === p.uid ? 'not-allowed' : 'pointer' }}
                            >
                              {busy === p.uid ? '…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => reject(p.uid, p.email)}
                              disabled={busy === p.uid}
                              className="team-remove-btn"
                              title="Reject — remove this request (they can ask again later)"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => block(p.uid, p.email)}
                              disabled={busy === p.uid}
                              className="team-remove-btn"
                              title="Block — reject and stop this email from requesting again"
                              style={{ color: '#f07070', borderColor: 'rgba(240,112,112,0.35)' }}
                            >
                              Block
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Blocked users — owner only */}
              {isOwner && blocked.length > 0 && (
                <div>
                  {sect(`Blocked (${blocked.length})`)}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {blocked.map(b => (
                      <div key={b.uid} className="team-member-row" style={{ opacity: 0.75 }}>
                        <Avatar email={b.email} name={b.email} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.email || b.uid}</div>
                          <div style={{ fontSize: 10, color: '#f07070', marginTop: 2 }}>⛔ Blocked</div>
                        </div>
                        <button
                          onClick={() => unblock(b.uid, b.email)}
                          disabled={busy === b.uid}
                          className="team-approve-btn"
                          title="Unblock — allow this user to request access again"
                        >
                          {busy === b.uid ? '…' : 'Unblock'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Share workspace link */}
              <div>
                {sect('Invite Link')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(var(--ovr),0.04)', border: '1px solid rgba(var(--ovr),0.1)', borderRadius: 9, padding: '9px 13px' }}>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {window.location.href.split('?')[0].split('#')[0]}
                  </span>
                  <button
                    onClick={copyLink}
                    className="team-copy-btn"
                    style={copied ? { borderColor: 'rgba(61,214,140,0.35)', color: '#3dd68c', background: 'rgba(61,214,140,0.1)' } : {}}
                  >
                    {copied ? '✓ Copied!' : 'Copy link'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55 }}>
                  Share this link. Teammates sign in with Google → their request shows up above → you approve them.
                </div>
              </div>

              {/* Status message */}
              {msg && (
                <div className={`team-msg ${msg.startsWith('✅') ? 'ok' : msg.startsWith('❌') ? 'err' : ''}`}>{msg}</div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ───────────────────────────────────────────── */}
      {showSettingsModal && (
        <div className="team-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}>
          <div className="team-modal-card">
            <div className="team-modal-header">
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>Settings</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Data, Claude MCP &amp; feedback</div>
              </div>
              <button className="team-modal-close" onClick={() => setShowSettingsModal(false)} title="Close" aria-label="Close">×</button>
            </div>

            <div style={{ padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', gap:8 }}>
                <button className="team-manage-btn" style={settingsTab === 'appearance' ? { color:'var(--text-strong)', background:'rgba(var(--ovr),0.08)' } : {}} onClick={() => setSettingsTab('appearance')}>Appearance</button>
                <button className="team-manage-btn" style={settingsTab === 'data' ? { color:'var(--text-strong)', background:'rgba(var(--ovr),0.08)' } : {}} onClick={() => setSettingsTab('data')}>Data &amp; Backup</button>
                <button className="team-manage-btn" style={settingsTab === 'mcp' ? { color:'var(--text-strong)', background:'rgba(var(--ovr),0.08)' } : {}} onClick={() => setSettingsTab('mcp')}>Claude MCP &amp; API key</button>
                <button className="team-manage-btn" style={settingsTab === 'feedback' ? { color:'var(--text-strong)', background:'rgba(var(--ovr),0.08)' } : {}} onClick={() => setSettingsTab('feedback')}>Feedback</button>
              </div>

              {settingsTab === 'appearance' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)' }}>Theme</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:-4 }}>Pick a look for your whole workspace. Saved to this device.</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                    {[
                      { id:'dark',   name:'Midnight', sub:'Dark · default',          sw:['#0d1117','#161b22','#58c4d4'],   grad:null,   paper:false, textColor:'#e6edf3' },
                      { id:'light',  name:'Paper',    sub:'White · grid notes',       sw:['#f7f7f5','#ffffff','#111111'],   grad:null,   paper:true,  textColor:'#1d1d1f' },
                      { id:'red',    name:'Red Nude', sub:'Cream · signature red',    sw:['#fff1e5','#fff8f1','#ed3024'],   grad:null,   paper:false, textColor:'#3a1612' },
                      { id:'aurora', name:'Aurora',   sub:'Dark · purple gradient',   sw:['#0e0817','#130a1f','#a855f7'],   grad:'linear-gradient(135deg,#0e0817,#1a0929,#0d1624)', paper:false, textColor:'#ddd6fe' },
                      { id:'candy',  name:'Candy',    sub:'Light · rose gradient',    sw:['#fce7f3','#fff5fa','#db2777'],   grad:'linear-gradient(135deg,#fce7f3,#fef0f7,#fae8ff)', paper:false, textColor:'#2d0d1e' },
                    ].map(opt => {
                      const active = theme === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => applyTheme(opt.id)}
                          style={{
                            textAlign:'left', cursor:'pointer', padding:0, overflow:'hidden',
                            borderRadius:11, background:'transparent',
                            border: active ? '2px solid var(--accent)' : '1px solid var(--line)',
                            boxShadow: active ? '0 0 0 3px var(--accent-soft)' : 'none',
                            transition:'all .12s ease',
                          }}
                        >
                          {/* Preview swatch */}
                          <div style={{
                            height:70, position:'relative',
                            background: opt.grad || opt.sw[0],
                            backgroundImage: opt.paper
                              ? 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)'
                              : 'none',
                            backgroundSize: opt.paper ? '12px 12px' : 'auto',
                            borderBottom:'1px solid var(--line)',
                          }}>
                            <div style={{ position:'absolute', left:8, top:8, width:'46%', height:10, borderRadius:3, background: opt.sw[1], opacity:0.85 }} />
                            <div style={{ position:'absolute', left:8, top:24, width:'66%', height:7, borderRadius:3, background: opt.sw[1], opacity:0.6 }} />
                            <div style={{ position:'absolute', left:8, bottom:9, width:22, height:22, borderRadius:6, background: opt.sw[2] }} />
                          </div>
                          <div style={{ padding:'8px 10px', background:'var(--panel)' }}>
                            <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-strong)', display:'flex', alignItems:'center', gap:5 }}>
                              {opt.name}
                              {active && <span style={{ fontSize:9, color:'var(--accent)' }}>● active</span>}
                            </div>
                            <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2 }}>{opt.sub}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {settingsTab === 'data' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)' }}>Workspace data</div>
                  {/* Backup download */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'rgba(var(--ovr),0.03)', border:'1px solid var(--line)', borderRadius:9, padding:'12px 14px' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>Download backup</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Export a full JSON backup of this workspace</div>
                    </div>
                    <button className="team-approve-btn" style={{ flexShrink:0 }} onClick={() => { exportLocalBackup(); }}>⬇ Backup</button>
                  </div>
                  {/* Import JSON */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'rgba(var(--ovr),0.03)', border:'1px solid var(--line)', borderRadius:9, padding:'12px 14px' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>Import workspace</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Load a JSON file as a new workspace</div>
                    </div>
                    <button className="team-manage-btn" style={{ flexShrink:0 }} onClick={() => { setShowSettingsModal(false); importData && importData(); }}>Import JSON</button>
                  </div>
                  {/* Export workspace */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'rgba(var(--ovr),0.03)', border:'1px solid var(--line)', borderRadius:9, padding:'12px 14px' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>Export workspace</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Save named workspace export with metadata</div>
                    </div>
                    <button className="team-manage-btn" style={{ flexShrink:0 }} onClick={() => { setShowSettingsModal(false); exportData && exportData(); }}>Export</button>
                  </div>
                </div>
              )}

              {settingsTab === 'mcp' && (
                <>
                  <div className="api-step">
                    <div className="api-step-num">1</div>
                    <div className="api-step-body">
                      <div className="api-step-title">Generate your API key</div>
                      <div className="api-step-desc">One key per account. Keep it private. The API server only accepts it while this account is approved in Team.</div>
                      {apiKey === null ? (
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>Loading…</div>
                      ) : apiKey ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                          <div className="api-key-box">
                            <span className="api-key-text">
                              {apiKeyVisible ? apiKey : apiKey.slice(0,8) + '•'.repeat(24)}
                            </span>
                            <button className="api-key-toggle" onMouseDown={e=>e.preventDefault()} onClick={()=>setApiKeyVisible(v=>!v)}>
                              {apiKeyVisible ? 'Hide' : 'Show'}
                            </button>
                            <button className="api-key-copy-btn" style={apiKeyCopied ? { color:'#3dd68c', borderColor:'rgba(61,214,140,0.4)' } : {}} onClick={copyApiKey}>
                              {apiKeyCopied ? '✓' : 'Copy'}
                            </button>
                          </div>
                          <button className="team-remove-btn" style={{ alignSelf:'flex-start', fontSize:11 }} onClick={handleRevokeKey} disabled={apiKeyBusy}>
                            {apiKeyBusy ? 'Revoking…' : 'Revoke key'}
                          </button>
                        </div>
                      ) : (
                        <button className="team-approve-btn" style={{ marginTop:8, alignSelf:'flex-start' }} onClick={handleGenerateKey} disabled={apiKeyBusy}>
                          {apiKeyBusy ? 'Generating…' : '+ Generate API key'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="api-step">
                    <div className="api-step-num">2</div>
                    <div className="api-step-body">
                      <div className="api-step-title">Add to Claude Code</div>
                      <div className="api-step-desc">Add the WAULT MCP server to Claude Code:</div>
                      <pre className="api-code-block">{`claude mcp add wault \\
  -e WAULT_API_URL=${browserApiUrl} \\
  -e WAULT_API_TOKEN=${apiKey || 'wn_xxxxxx_...'} \\
  -- node "/path/to/wault-mcp.mjs"`}</pre>
                      <div className="api-step-desc" style={{ marginTop:6 }}>Or paste this into <code>~/.claude/settings.json</code> → <code>mcpServers</code>:</div>
                      <pre className="api-code-block" style={{ fontSize:11 }}>{JSON.stringify({
                        wault: {
                          command: "node",
                          args: ["/path/to/wault-mcp.mjs"],
                          env: {
                            WAULT_API_URL: browserApiUrl,
                            WAULT_API_TOKEN: apiKey || "wn_xxxxxx_..."
                          }
                        }
                      }, null, 2)}</pre>
                    </div>
                  </div>
                  <div className="api-step">
                    <div className="api-step-num">3</div>
                    <div className="api-step-body">
                      <div className="api-step-title">Start using it</div>
                      <div className="api-step-desc">Open Claude Code and type: <em>"list my WAULT pages"</em> or <em>"read the XALT home page"</em></div>
                      <div className="api-step-desc" style={{ marginTop:4 }}>Claude can read and write pages while your account remains approved in Team.</div>
                    </div>
                  </div>
                </>
              )}

              {settingsTab === 'feedback' && (
                <div className="api-step">
                  <div className="api-step-num">✎</div>
                  <div className="api-step-body">
                    <div className="api-step-title">Leave feedback</div>
                    <div className="api-step-desc">Send software feedback, bugs, or feature requests to the workspace owner.</div>
                    <textarea
                      className="shoot-paste-area"
                      style={{ minHeight:110, marginTop:8 }}
                      placeholder="What should be improved?"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                    />
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8 }}>
                      <button className="team-approve-btn" onClick={submitFeedback} disabled={feedbackBusy || !feedbackText.trim()}>
                        {feedbackBusy ? 'Sending…' : 'Send feedback'}
                      </button>
                      {feedbackMsg && <span style={{ fontSize:12, color: feedbackMsg.startsWith('Failed') ? '#ff7369' : '#3dd68c' }}>{feedbackMsg}</span>}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </>
  );
}

function App() {
  const initialLocal = useMemo(() => initializeLocalWorkspaces(), []);
  const [data, setData] = useState(() => {
    // Start with localStorage data immediately (fast load)
    return loadLocalWorkspaceData(initialLocal.activeId);
  });

  // ── Firebase Auth state ────────────────────────────────────────────────────
  const [authLoading, setAuthLoading] = useState(true);   // true until Firebase answers
  const [authUser, setAuthUser] = useState(null);          // Firebase user object or null
  const [userAccess, setUserAccess] = useState(null);      // { email, role } or null
  const [firebaseAccessDenied, setFirebaseAccessDenied] = useState(false);
  const [cloudCatalogueReady, setCloudCatalogueReady] = useState(false);
  const [cloudWorkspaceLoading, setCloudWorkspaceLoading] = useState(false);
  const [workspaceApiReady, setWorkspaceApiReady] = useState(false);
  const authUnsubRef = useRef(null);
  const firebaseCatalogueLoadedRef = useRef(false);
  const localWorkspaceRescueDoneRef = useRef(false);

  // Safety net: the "Connecting…" gate must never be permanent. If Firebase init
  // or the access check stalls (offline RTDB read, listener race, blocked rules),
  // force the gate open after a hard deadline so the user always reaches the
  // sign-in screen (or their workspace) instead of an infinite spinner.
  useEffect(() => {
    if (!authLoading) return;
    const t = setTimeout(() => {
      console.warn('⏱️ Auth check exceeded 12s — unblocking sign-in gate');
      setAuthLoading(false);
    }, 12000);
    return () => clearTimeout(t);
  }, [authLoading]);

  // (Firebase load + listener are handled inside the Firebase init effect below)
  const [localWorkspaces, setLocalWorkspaces] = useState(initialLocal.workspaces);
  const [activeLocalWorkspaceId, setActiveLocalWorkspaceId] = useState(initialLocal.activeId);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useEffect(() => {
    const handler = () => setMobileSidebarOpen(v => !v);
    window.addEventListener("wault-sidebar-toggle", handler);
    return () => window.removeEventListener("wault-sidebar-toggle", handler);
  }, []);
  const [presenceLocks, setPresenceLocks] = useState({});
  const [firebasePresence, setFirebasePresence] = useState({});
  const firebasePresenceUnsubRef = useRef(null);
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

  // Safety net for the signed-in workspace gate. The app should never strand the
  // user on "Opening workspace" forever; if the cloud load stalls, show the app
  // with the current Firebase/error state so the user can retry or switch.
  useEffect(() => {
    if (!cloudWorkspaceLoading) return;
    const t = setTimeout(() => {
      console.warn('⏱️ Workspace load exceeded 8s — unblocking workspace gate');
      setCloudWorkspaceLoading(false);
      setCloudCatalogueReady(true);
      setSyncState((s) => ({
        ...s,
        status: s.error ? s.status : "Workspace load is taking longer than expected",
        firebaseStatus: s.error ? s.firebaseStatus : "Workspace load delayed",
      }));
    }, 8000);
    return () => clearTimeout(t);
  }, [cloudWorkspaceLoading, activeLocalWorkspaceId]);

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
          const normalized = normalizeWorkspaceData(syncedData);
          // Protect the page the user is actively editing from cross-tab overwrites.
          // Without this, Tab 2 saving stale content would clobber Tab 1's typing.
          const active = document.activeElement;
          if (active?.closest?.('[data-block-id]') || active?.isContentEditable) {
            const pid = current.currentPageId;
            if (pid && current.pages?.[pid]) {
              normalized.pages = { ...normalized.pages, [pid]: current.pages[pid] };
              normalized.currentPageId = pid;
            }
          }
          return normalized;
        }
        return current;
      });
    });
  }, []);

  // Apply updates written by Claude (or any external API tool) via the local API server
  useEffect(() => {
    const handler = (e) => {
      const { workspaceId, data: apiData } = e.detail || {};
      if (!apiData || workspaceId !== activeLocalWorkspaceId) return;
      console.log('🤖 Applying API update from Claude...');
      setData(normalizeWorkspaceData(apiData));
    };
    window.addEventListener('workspace-api-update', handler);
    return () => window.removeEventListener('workspace-api-update', handler);
  }, [activeLocalWorkspaceId]);

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

  // ── Firebase: init → load newer cloud data → set up real-time listener ──────
  // Everything Firebase-related runs in this single effect so that the listener
  // and the hybrid load are always set up AFTER Firebase is actually ready.
  const lastFirebaseSaveTimeRef = useRef(0);
  const firebaseListenerUnsubRef = useRef(null);
  // Remote-apply guard: holds the exact `data` object produced by applying a remote
  // Firebase update. The save effect compares by reference and SKIPS the cloud push for
  // that object — breaking the A→B→A→B infinite re-save ping-pong. Any subsequent LOCAL
  // edit creates a new object (≠ this ref) and pushes normally, so no edits are lost.
  // Also used to detect unsaved local edits: if current data ≠ this ref, the user has
  // typed since the last confirmed Firebase save (guard against listener overwriting content).
  const lastRemoteDataRef = useRef(null);
  const lastRemoteUpdatedAtRef = useRef("");
  const cloudPreviewWorkspaceRef = useRef(null);
  const cloudPreviewDataRef = useRef(null);
  // True from when a Firebase save is in-flight until it resolves. The listener
  // skips remote applies while this is set so a slow save can't be raced by old data.
  const pendingLocalSaveRef = useRef(false);
  // If a Firebase-listed workspace cannot be loaded, show an error page but never
  // persist that placeholder back over the real cloud record.
  const skipPersistenceWorkspaceRef = useRef(null);
  // The workspace id whose CONTENT is currently loaded into `data`. The autosave
  // effect must never write `data` under a different workspace id (the switch race
  // that contaminated workspaces with each other's pages). Updated only when a
  // workspace's content is actually rendered.
  const loadedWorkspaceIdRef = useRef(null);
  // Tracks whether the very first cold workspace load has completed, so the
  // full-screen "Opening workspace" gate only ever shows once (never on switch).
  const initialContentLoadDoneRef = useRef(false);
  // Live /workspaceCatalog subscription unsubscribe (replaces the 8s Railway poll).
  const catalogueUnsubRef = useRef(null);
  // Stable per-tab session ID — survives re-renders, used for echo suppression AND presence key.
  // sessionStorage ensures the same tab reuses the same key after soft reloads.
  const localSaveIdRef = useRef(
    sessionStorage.getItem('wn_session_id') ||
    (() => {
      const id = 'sess_' + Math.random().toString(36).slice(2);
      try { sessionStorage.setItem('wn_session_id', id); } catch {}
      return id;
    })()
  );
  // Expose session ID globally so PageEditor (child) can access it without prop drilling.
  window._wnSessionId = localSaveIdRef.current;

  useEffect(() => {
    let cancelled = false;

    const applyTeamWorkspaceCatalogue = (list = []) => {
      const nextList = replaceSignedInWorkspaceCatalogue(list);
      setLocalWorkspaces(nextList);
      setCloudCatalogueReady(true);
      setSyncState((s) => ({
        ...s,
        workspaces: nextList,
        status: nextList.length ? "Loaded team workspaces" : "No Firebase workspaces yet",
        firebaseStatus: nextList.length ? "Team catalogue loaded" : "No Firebase workspaces yet",
      }));

      const rememberedActive = localStorage.getItem(LOCAL_ACTIVE_WORKSPACE_KEY) || activeLocalWorkspaceId;
      const currentStillExists = nextList.some((w) => w.id === activeLocalWorkspaceId);
      const rememberedStillExists = nextList.some((w) => w.id === rememberedActive);
      const nextActiveId = currentStillExists
        ? activeLocalWorkspaceId
        : (rememberedStillExists ? rememberedActive : nextList[0]?.id);
      const nextActiveWorkspace = nextList.find((workspace) => workspace.id === nextActiveId) || nextList[0];

      if (!nextList.length) {
        skipPersistenceWorkspaceRef.current = activeLocalWorkspaceId || "cloud_empty";
        setData(createWorkspaceUnavailableData("No team workspaces", "Firebase did not return any workspaces for this approved account. Create a shared or private workspace to begin."));
        setCloudWorkspaceLoading(false);
        return { list: nextList, activeId: "", changedActive: false };
      }

      setSyncState((s) => ({
        ...s,
        workspaceId: nextActiveWorkspace?.id || s.workspaceId,
        workspaceName: nextActiveWorkspace?.name || s.workspaceName,
        workspaces: nextList,
      }));

      if (nextActiveId && nextActiveId !== activeLocalWorkspaceId) {
        localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, nextActiveId);
        setActiveLocalWorkspaceId(nextActiveId);
        // The actual workspace content load happens in the next effect run for
        // the new active id. Clear this effect's loading flag so the gate cannot
        // stay stuck while React schedules that rerun.
        setCloudWorkspaceLoading(false);
      }

      firebaseCatalogueLoadedRef.current = true;
      return { list: nextList, activeId: nextActiveId, changedActive: !!(nextActiveId && nextActiveId !== activeLocalWorkspaceId) };
    };

    const rescueLocalDraftsToFirebase = async (firebaseSync, remoteList = []) => {
      if (localWorkspaceRescueDoneRef.current) return remoteList;
      localWorkspaceRescueDoneRef.current = true;
      const user = firebaseSync.getCurrentUser?.();
      if (!user?.uid || !firebaseSync?.saveWorkspace) return remoteList;
      const remoteIds = new Set((remoteList || []).map((workspace) => workspace?.id).filter(Boolean));
      const drafts = discoverLocalWorkspaceDrafts(remoteList).filter((draft) => !remoteIds.has(draft.id));
      if (!drafts.length) return remoteList;

      const rescued = [];
      for (const draft of drafts) {
        try {
          const metadata = {
            id: draft.id,
            name: draft.name,
            visibility: draft.visibility || "shared",
            ownerUid: user.uid,
            ownerEmail: (user.email || "").toLowerCase(),
            updatedAt: new Date().toISOString(),
          };
          const saved = await firebaseSync.saveWorkspace(draft.id, draft.data, localSaveIdRef.current, metadata);
          if (firebaseSaveSucceeded(saved)) {
            rescued.push({ ...metadata, pageCount: Object.keys(draft.data?.pages || {}).length, currentPageId: draft.data?.currentPageId || null });
            console.log(`☁️ Published local workspace draft to Firebase: ${draft.name} (${draft.id})`);
          }
        } catch (err) {
          console.warn(`⚠️ Could not publish local workspace draft ${draft.id}:`, err.message);
        }
      }
      return rescued.length ? [...remoteList, ...rescued] : remoteList;
    };

    const connectWorkspaceBridge = async (firebaseSync) => {
      setWorkspaceApiReady(false);
      // The team workspace catalogue is now read DIRECTLY from Firebase
      // (/workspaceCatalog has a node-level .read for approved members). The
      // Railway API is no longer required for the web app to discover workspaces;
      // it stays only for the Claude/MCP integration. Mint a personal API key in
      // the background so MCP delete keeps working, but never block on it.
      (async () => {
        try {
          const bridge = window.WorkspaceApiBridge;
          if (!bridge?.setApiToken) return;
          let key = await firebaseSync.getApiKey?.();
          if (!key) key = await firebaseSync.generateApiKey?.();
          if (key) { bridge.setApiToken(key); setWorkspaceApiReady(true); }
        } catch (err) {
          console.warn("⚠️ Background API key mint failed (non-fatal):", err.message);
        }
      })();

      try {
        const list = await firebaseSync.listAllWorkspaces();
        if (cancelled) return;
        // NOTE: we intentionally do NOT auto-publish local browser drafts into the
        // shared team catalogue. That behaviour (rescueLocalDraftsToFirebase) dumped
        // each teammate's per-browser seed workspaces ("My Workspace", "Untitled
        // Workspace", template copies) into Firebase, creating duplicate same-named
        // workspaces with different ids — which looked like "the same workspace has
        // different content". The catalogue now only contains workspaces created
        // explicitly via the New-workspace flow.
        return applyTeamWorkspaceCatalogue(list || []);
      } catch (err) {
        if (cancelled) return;
        console.warn("⚠️ Firebase catalogue read failed — falling back to local cache:", err.message);
        // Never blank the app: fall back to the last-known local workspace list so
        // the user can keep working even if the catalogue read momentarily fails.
        const cached = readJson(LOCAL_WORKSPACES_KEY, []) || [];
        setSyncState((s) => ({
          ...s,
          status: cached.length ? "Using cached workspace list" : s.status,
          firebaseStatus: "Catalogue read failed — using cache",
        }));
        return applyTeamWorkspaceCatalogue(cached);
      }
    };

    const setupListener = (firebaseSync, workspaceId) => {
      // Tear down any previous listener for this workspace
      if (firebaseListenerUnsubRef.current) {
        firebaseListenerUnsubRef.current();
        firebaseListenerUnsubRef.current = null;
      }

      const unsubscribe = firebaseSync.onWorkspaceUpdate(workspaceId, (remoteRecord) => {
        // remoteRecord = { workspace: {...}, updated_at: "...", source: "firebase" }
        if (!remoteRecord?.workspace) return;

        // Skip updates that originated from this browser session (echo prevention)
        if (remoteRecord.saveId && remoteRecord.saveId === localSaveIdRef.current) {
          if (remoteRecord.updated_at) lastRemoteUpdatedAtRef.current = remoteRecord.updated_at;
          console.log('ℹ️ Skipping own Firebase echo (session ID match)');
          return;
        }

        // Guard 1: skip if a local save is currently in-flight.
        // The async saveWorkspace call (even with the cached access check) takes
        // ~100–300 ms. A remote-looking update that arrives during this window is
        // almost always an old snapshot from a previous session — applying it would
        // overwrite the content that is literally being saved right now.
        if (pendingLocalSaveRef.current) {
          console.log('⏳ Skipping Firebase update — local save in flight');
          return;
        }

        console.log('📱 Firebase update received', remoteRecord.saveId);
        setData((current) => {
          // Guard 2: skip if the user has local edits that haven't been confirmed
          // by Firebase yet. `lastRemoteDataRef.current` is the last state that
          // came FROM Firebase (or the initial loaded state). Any local keystroke
          // creates a new state object (≠ this ref), signalling unsaved edits.
          // We skip the remote apply so the user's typing isn't clobbered; the
          // save debounce (200 ms) will push the local version to Firebase shortly.
          if (current !== lastRemoteDataRef.current) {
            console.log('⏳ Skipping Firebase update — local edits pending save');
            return current;
          }

          const merged = normalizeWorkspaceData(remoteRecord.workspace);
          // ── BLOCK-level merge ────────────────────────────────────────────────
          // Apply the remote version of EVERYTHING — every page AND every block —
          // so a teammate's edits to OTHER blocks (even on the same page you're on)
          // appear live. The ONLY thing we keep local is the single block your cursor
          // is currently inside, so your in-progress typing isn't clobbered mid-keystroke.
          // (Same-block simultaneous edits fall back to last-write-wins — that's what
          //  the soft-lock warns about.)
          const active = document.activeElement;
          const activeBlockEl = active?.closest?.('[data-block-id]');
          const activeBlockId = activeBlockEl?.getAttribute('data-block-id');
          const pid = current.currentPageId;
          if (activeBlockId && pid && current.pages?.[pid] && merged.pages?.[pid]) {
            const localBlocks = current.pages[pid].blocks || [];
            const remotePage = merged.pages[pid];
            const remoteBlocks = remotePage.blocks || [];
            const localActive = localBlocks.find((b) => b.id === activeBlockId);
            if (localActive) {
              let mergedBlocks;
              if (remoteBlocks.some((b) => b.id === activeBlockId)) {
                // Replace remote's copy of the active block with the local (in-progress) one.
                mergedBlocks = remoteBlocks.map((b) => (b.id === activeBlockId ? localActive : b));
              } else {
                // Remote doesn't have this block yet (you just created it) — insert it at
                // roughly its local position so it isn't lost.
                const idx = localBlocks.findIndex((b) => b.id === activeBlockId);
                mergedBlocks = [...remoteBlocks];
                mergedBlocks.splice(Math.max(0, Math.min(idx, mergedBlocks.length)), 0, localActive);
              }
              merged.pages = { ...merged.pages, [pid]: { ...remotePage, blocks: mergedBlocks } };
            }
          }
          // Never let a remote update hijack which page you're looking at.
          const next = { ...merged, currentPageId: pid };
          // Mark this exact object as remote-applied so the save effect won't re-push it,
          // and so future listener fires can compare against it to detect local edits.
          lastRemoteDataRef.current = next;
          lastRemoteUpdatedAtRef.current = remoteRecord.updated_at || new Date().toISOString();
          cloudPreviewWorkspaceRef.current = null;
          cloudPreviewDataRef.current = null;
          loadedWorkspaceIdRef.current = workspaceId;
          try {
            localStorage.setItem(localWorkspaceDataKey(workspaceId), JSON.stringify(next));
            localStorage.setItem(`${workspaceId}_local_saved_at`, lastRemoteUpdatedAtRef.current);
            localStorage.setItem(localFirebaseRevisionKey(workspaceId), lastRemoteUpdatedAtRef.current);
          } catch {}
          const pending = readPendingWorkspaceDraft(workspaceId);
          if (pending && (Date.parse(pending.savedAt) || 0) <= (Date.parse(lastRemoteUpdatedAtRef.current) || 0)) {
            clearPendingWorkspaceDraft(workspaceId);
          }
          return next;
        });
      });

      firebaseListenerUnsubRef.current = unsubscribe;
    };

    const loadFirebaseWorkspaceAndListen = async (firebaseSync, workspaceId) => {
      if (!workspaceId || cancelled) {
        if (!cancelled) setCloudWorkspaceLoading(false);
        return false;
      }
      const currentUser = firebaseSync.getCurrentUser?.();
      if (!currentUser?.uid) {
        setCloudWorkspaceLoading(false);
        return false;
      }
      if (isWorkspaceTombstoned(workspaceId)) {
        setCloudWorkspaceLoading(false);
        return false;
      }

      // ── Cache-first render (no full-screen gate on switch) ─────────────────
      // If we have a local copy of this workspace, show it INSTANTLY and refresh
      // from Firebase in the background. The "Opening workspace" gate only shows
      // on a genuine cold load (a workspace this browser has never opened).
      const cachedRaw = readJson(localWorkspaceDataKey(workspaceId), null);
      const haveCache = !!(cachedRaw && cachedRaw.pages && !isWorkspaceUnavailableData(cachedRaw));
      if (haveCache) {
        const cached = restoreRememberedPage(workspaceId, normalizeWorkspaceData(cachedRaw));
        if (skipPersistenceWorkspaceRef.current === workspaceId) skipPersistenceWorkspaceRef.current = null;
        lastRemoteDataRef.current = null;     // local cache is not a confirmed remote base
        lastRemoteUpdatedAtRef.current = "";
        cloudPreviewWorkspaceRef.current = workspaceId;
        cloudPreviewDataRef.current = cached;
        loadedWorkspaceIdRef.current = null;
        setData(cached);
        setCloudWorkspaceLoading(false);
      } else {
        setCloudWorkspaceLoading(true);       // cold load → brief gate is acceptable
      }

      try {
        const firebaseRecord = await firebaseSync.loadWorkspace(workspaceId);
        if (cancelled) return false;
        if (firebaseRecord?.workspace) {
          console.log('📡 Loading workspace from Firebase source of truth');
          const loaded = restoreRememberedPage(workspaceId, normalizeWorkspaceData(firebaseRecord.workspace));
          const remoteUpdatedAt = firebaseRecord.updated_at || new Date().toISOString();
          const pending = readPendingWorkspaceDraft(workspaceId);
          const cloudDraft = normalizeCloudWorkspaceDraft(
            workspaceId,
            firebaseSync.loadWorkspaceDraft ? await firebaseSync.loadWorkspaceDraft(workspaceId) : null
          );
          const indexedDraft = normalizeIndexedWorkspaceBackup(workspaceId, await readLatestIndexedWorkspaceBackup(workspaceId));
          const replayDraft = newestReplayableDraft(remoteUpdatedAt, pending, cloudDraft, indexedDraft);
          const replayPending = !!replayDraft;
          if (pending && !replayPending && (Date.parse(pending.savedAt) || 0) <= (Date.parse(remoteUpdatedAt) || 0)) {
            clearPendingWorkspaceDraft(workspaceId);
          }
          if (cloudDraft && !replayPending && (Date.parse(cloudDraft.savedAt) || 0) <= (Date.parse(remoteUpdatedAt) || 0)) {
            firebaseSync.clearWorkspaceDraft?.(workspaceId);
          }
          if (skipPersistenceWorkspaceRef.current === workspaceId) skipPersistenceWorkspaceRef.current = null;
          cloudPreviewWorkspaceRef.current = null;
          cloudPreviewDataRef.current = null;
          loadedWorkspaceIdRef.current = workspaceId;
          lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
          lastRemoteDataRef.current = loaded;
          const rendered = replayPending ? restoreRememberedPage(workspaceId, normalizeWorkspaceData(replayDraft.data)) : loaded;
          setData(rendered);
          try {
            localStorage.setItem(localWorkspaceDataKey(workspaceId), JSON.stringify(rendered));
            localStorage.setItem(`${workspaceId}_local_saved_at`, replayPending ? replayDraft.savedAt : lastRemoteUpdatedAtRef.current);
            localStorage.setItem(localFirebaseRevisionKey(workspaceId), lastRemoteUpdatedAtRef.current);
          } catch {}
          setupListener(firebaseSync, workspaceId);
          setSyncState((s) => ({
            ...s,
            workspaceId,
            status: replayPending ? "Restoring unsynced draft" : "Loaded from Firebase",
            firebaseStatus: replayPending ? "Restoring unsynced draft to Firebase" : "Synced to cloud ✓",
            error: "",
          }));
          return true;
        }

        const cloudDraft = normalizeCloudWorkspaceDraft(
          workspaceId,
          firebaseSync.loadWorkspaceDraft ? await firebaseSync.loadWorkspaceDraft(workspaceId) : null
        );
        const indexedDraft = normalizeIndexedWorkspaceBackup(workspaceId, await readLatestIndexedWorkspaceBackup(workspaceId));
        const fallbackDraft = newestReplayableDraft("", cloudDraft, indexedDraft);
        if (fallbackDraft?.data?.pages) {
          const restored = restoreRememberedPage(workspaceId, normalizeWorkspaceData(fallbackDraft.data));
          if (skipPersistenceWorkspaceRef.current === workspaceId) skipPersistenceWorkspaceRef.current = null;
          cloudPreviewWorkspaceRef.current = null;
          cloudPreviewDataRef.current = null;
          loadedWorkspaceIdRef.current = workspaceId;
          lastRemoteDataRef.current = null;
          lastRemoteUpdatedAtRef.current = fallbackDraft.baseUpdatedAt || "";
          writePendingWorkspaceDraft(workspaceId, restored, fallbackDraft.baseUpdatedAt || "");
          setData(restored);
          try {
            localStorage.setItem(localWorkspaceDataKey(workspaceId), JSON.stringify(restored));
            localStorage.setItem(`${workspaceId}_local_saved_at`, fallbackDraft.savedAt);
          } catch {}
          setupListener(firebaseSync, workspaceId);
          setSyncState((s) => ({
            ...s,
            workspaceId,
            status: fallbackDraft.source === "indexed-backup" ? "Restoring local safety backup" : "Restoring Firebase safety draft",
            firebaseStatus: "Restoring safety backup to Firebase",
            error: "",
          }));
          return true;
        }

        const workspace = (readJson(LOCAL_WORKSPACES_KEY, []) || []).find((w) => w.id === workspaceId);
        skipPersistenceWorkspaceRef.current = workspaceId;
        const unavailable = createWorkspaceUnavailableData(
          workspace?.name || "Workspace unavailable",
          "Firebase did not return a workspace record for this catalogue item. This usually means the workspace was deleted, private to another owner, or the cloud save has not completed."
        );
        lastRemoteDataRef.current = unavailable;
        lastRemoteUpdatedAtRef.current = "";
        cloudPreviewWorkspaceRef.current = null;
        cloudPreviewDataRef.current = null;
        loadedWorkspaceIdRef.current = null;
        setData(unavailable);
        setSyncState((s) => ({
          ...s,
          error: "Workspace missing from Firebase.",
          status: "Workspace missing from Firebase",
          firebaseStatus: "Workspace missing from Firebase",
        }));
        setupListener(firebaseSync, workspaceId);
        return false;
      } catch (err) {
        console.warn('⚠️ Firebase workspace load failed:', err.message);
        if (haveCache) {
          cloudPreviewWorkspaceRef.current = workspaceId;
          loadedWorkspaceIdRef.current = null;
        }
        setSyncState((s) => ({
          ...s,
          error: haveCache ? "" : (err.message || "Workspace load failed"),
          status: haveCache ? "Cached preview only" : "Workspace load failed",
          firebaseStatus: haveCache ? "Cloud refresh failed — not saving cache" : "Workspace load failed",
        }));
        return false;
      } finally {
        if (!cancelled) { setCloudWorkspaceLoading(false); initialContentLoadDoneRef.current = true; }
      }
    };

    const run = async () => {
      // Reset sync-state refs so a workspace switch starts with a clean slate.
      // Without this, lastRemoteDataRef from the previous workspace would make the
      // local-edit guard think there are always pending edits in the new workspace.
      lastRemoteDataRef.current = null;
      lastRemoteUpdatedAtRef.current = "";
      cloudPreviewWorkspaceRef.current = null;
      cloudPreviewDataRef.current = null;
      pendingLocalSaveRef.current = false;
      loadedWorkspaceIdRef.current = null;

      // ── Step 1: get or initialise the Firebase sync object ─────────────────
      let firebaseSync = window.WorkspaceFirebaseSync;
      if (!firebaseSync) {
        try {
          // Await the native ESM init that ran in index.html (avoids Babel transforming import())
          firebaseSync = await (window.__firebaseInitPromise || Promise.resolve(null));
          if (!firebaseSync) {
            setSyncState((s) => ({ ...s, firebaseStatus: 'Cloud backup not configured' }));
            setAuthLoading(false); // unblock sign-in gate even when config missing
            return;
          }
          window.WorkspaceFirebaseSync = firebaseSync;
          console.log('🔥 Firebase initialized');
          setSyncState((s) => ({ ...s, firebaseStatus: 'Connected to cloud' }));

          // ── Wire up Google Auth listener ────────────────────────────────────
          // Clean up any previous listener
          if (authUnsubRef.current) { authUnsubRef.current(); authUnsubRef.current = null; }

          // Auth state is app-global (not per-workspace), so this callback must NOT
          // early-return on `cancelled`. The listener outlives a workspace switch;
          // a stale `cancelled=true` closure swallowing setAuthLoading(false) is what
          // left the user stuck on "Connecting…". Always resolve the gate.
          authUnsubRef.current = firebaseSync.onAuthStateChange(async (fbUser) => {
            if (!fbUser) {
              // Signed out
              firebaseCatalogueLoadedRef.current = false;
              window.WorkspaceApiBridge?.setApiToken?.("");
              setAuthUser(null);
              setUserAccess(null);
              setFirebaseAccessDenied(false);
              setCloudCatalogueReady(false);
              setCloudWorkspaceLoading(false);
              setWorkspaceApiReady(false);
              setAuthLoading(false);
              return;
            }
            // Signed in — check access list
            setAuthUser(fbUser);
            try {
              const access = await firebaseSync.checkUserAccess(fbUser);
              if (access && !access.blocked) {
                setUserAccess(access);
                setFirebaseAccessDenied(false);
                setAuthLoading(false);
                // Open the remembered workspace IMMEDIATELY (cache-first). The gate
                // only ever waits on this one workspace's content, never on the team
                // catalogue. The catalogue loads in the BACKGROUND (not awaited) and
                // just fills the workspace dropdown — so a slow/failed catalogue read
                // can never strand the user on "Opening workspace".
                loadFirebaseWorkspaceAndListen(firebaseSync, activeLocalWorkspaceId);
                connectWorkspaceBridge(firebaseSync);
              } else {
                window.WorkspaceApiBridge?.setApiToken?.("");
                setCloudCatalogueReady(false);
                setCloudWorkspaceLoading(false);
                setWorkspaceApiReady(false);
                setUserAccess(null);
                setFirebaseAccessDenied(true);
                setAuthLoading(false);
              }
            } catch (err) {
              window.WorkspaceApiBridge?.setApiToken?.("");
              console.warn('⚠️ Access check failed:', err.message);
              setUserAccess(null); setFirebaseAccessDenied(false);
              setCloudWorkspaceLoading(false);
              setAuthLoading(false);
            }
          });
        } catch (err) {
          console.warn('⚠️ Firebase init failed:', err.message);
          setSyncState((s) => ({ ...s, firebaseStatus: 'Cloud backup offline' }));
          setAuthLoading(false); // unblock app even if Firebase fails
          return;
        }
      } else {
        // Firebase was already initialised (hot reload / workspace switch)
        // Re-check current user synchronously so auth state is fresh
        const currentUser = firebaseSync.getCurrentUser?.();
        if (currentUser) {
          setAuthUser(currentUser);
          firebaseSync.checkUserAccess(currentUser).then(async access => {
            if (cancelled) return;
            const ok = access && !access.blocked;
            setUserAccess(ok ? access : null);
            setFirebaseAccessDenied(!ok);
            if (ok) {
              // Switch / hot-reload path: render the active workspace's content
              // (cache-first, no gate) and refresh the catalogue in the background.
              // Never block on the catalogue.
              setAuthLoading(false);
              loadFirebaseWorkspaceAndListen(firebaseSync, activeLocalWorkspaceId);
              connectWorkspaceBridge(firebaseSync);
            }
            else {
              window.WorkspaceApiBridge?.setApiToken?.("");
              setCloudCatalogueReady(false);
              setCloudWorkspaceLoading(false);
              setWorkspaceApiReady(false);
            }
            if (!ok) setAuthLoading(false);
          }).catch(() => {
            if (!cancelled) {
              setCloudWorkspaceLoading(false);
              setAuthLoading(false);
            }
          });
        } else {
          window.WorkspaceApiBridge?.setApiToken?.("");
          setCloudCatalogueReady(false);
          setCloudWorkspaceLoading(false);
          setWorkspaceApiReady(false);
          setAuthLoading(false);
        }
      }

      // Content loading is driven directly by the auth branches above
      // (loadFirebaseWorkspaceAndListen) — never gated on the catalogue.
    };

    run();

    return () => {
      cancelled = true;
      if (firebaseListenerUnsubRef.current) {
        firebaseListenerUnsubRef.current();
        firebaseListenerUnsubRef.current = null;
      }
      // Note: we keep the auth listener alive across workspace switches
      // (authUnsubRef is only cleaned up on unmount via a separate effect)
    };
  }, [activeLocalWorkspaceId]); // re-runs when the active workspace changes

  // Clean up auth listener on unmount
  useEffect(() => {
    return () => {
      if (authUnsubRef.current) { authUnsubRef.current(); authUnsubRef.current = null; }
    };
  }, []);

  // Signed-in workspace catalogue source of truth is /workspaceCatalog, read
  // LIVE from Firebase (node-level .read for approved members). This replaces the
  // old 8s Railway poll that wholesale-replaced the local list every tick and
  // could wipe a freshly-created workspace. Every workspace is shared, so all
  // approved members see the same team catalogue. Do not mirror `localWorkspaces`
  // back to /users/{uid}/workspace_list.
  useEffect(() => {
    if (!authUser?.uid || !userAccess || firebaseAccessDenied) return;
    const firebaseSync = window.WorkspaceFirebaseSync;
    if (!firebaseSync?.onWorkspaceCatalogUpdate) return;

    const unsub = firebaseSync.onWorkspaceCatalogUpdate((list, deletedIds = []) => {
      (deletedIds || []).forEach((workspaceId) => {
        tombstoneWorkspace(workspaceId);
        cleanupLocalWorkspaceArtifacts(workspaceId);
      });
      const nextList = mergeSignedInWorkspaceCatalogue(list || [], activeLocalWorkspaceId);
      setLocalWorkspaces(nextList);
      setSyncState((s) => ({
        ...s,
        workspaces: nextList,
        firebaseStatus: "Team catalogue loaded",
      }));
      setCloudCatalogueReady(true);

      const activeStillExists = nextList.some((workspace) => workspace.id === activeLocalWorkspaceId);
      if (!activeStillExists && nextList[0]?.id) {
        localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, nextList[0].id);
        setActiveLocalWorkspaceId(nextList[0].id);
      }
    });
    catalogueUnsubRef.current = unsub;

    return () => {
      if (catalogueUnsubRef.current) { catalogueUnsubRef.current(); catalogueUnsubRef.current = null; }
    };
  }, [authUser?.uid, userAccess?.role, firebaseAccessDenied, activeLocalWorkspaceId]);

  // ── Firebase presence listener (who is editing which block) ─────────────────
  useEffect(() => {
    const firebaseSync = window.WorkspaceFirebaseSync;
    if (!firebaseSync?.onPresenceUpdate || !authUser?.uid) return;

    // Tear down previous listener if workspace changed
    if (firebasePresenceUnsubRef.current) {
      firebasePresenceUnsubRef.current();
      firebasePresenceUnsubRef.current = null;
    }

    // Pass our own sessionId so the server-side listener skips our own tab's presence.
    const unsubscribe = firebaseSync.onPresenceUpdate(
      activeLocalWorkspaceId,
      (byBlock) => { setFirebasePresence(byBlock); },
      localSaveIdRef.current  // ownSessionId — filtered out in onPresenceUpdate
    );

    firebasePresenceUnsubRef.current = unsubscribe || null;

    return () => {
      if (firebasePresenceUnsubRef.current) {
        firebasePresenceUnsubRef.current();
        firebasePresenceUnsubRef.current = null;
      }
    };
  }, [activeLocalWorkspaceId, authUser?.uid]);

  // Debounced local + remote save
  const saveTimer = useRef(null);
  const draftSaveTimer = useRef(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    if (skipPersistenceWorkspaceRef.current === activeLocalWorkspaceId) {
      console.warn('⚠️ Skipping persistence for cloud error placeholder:', activeLocalWorkspaceId);
      return;
    }
    const signedInUnsynced = !!(
      authUser &&
      activeLocalWorkspaceId &&
      data?.pages &&
      !isWorkspaceUnavailableData(data) &&
      data !== lastRemoteDataRef.current
    );
    const uneditedCloudPreview = !!(
      authUser &&
      cloudPreviewWorkspaceRef.current === activeLocalWorkspaceId &&
      data === cloudPreviewDataRef.current
    );
    if (signedInUnsynced && !uneditedCloudPreview) {
      writePendingWorkspaceDraft(activeLocalWorkspaceId, data, lastRemoteUpdatedAtRef.current || "");
      const backup = writeLocalAutoBackup(activeLocalWorkspaceId, data, "pending-cloud-save");
      if (backup) setSyncState((s) => ({ ...s, backupStatus: `Safety backup ${new Date(backup.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}` }));
    }
    // ── Switch-race guard (prevents cross-workspace page contamination) ────────
    // When signed in, `data` must belong to the active workspace before we persist
    // it. During a switch, `activeLocalWorkspaceId` flips to the new workspace a
    // beat before its content loads, so `data` is still the OLD workspace's pages.
    // Writing here would save workspace A's pages under workspace B's id (the exact
    // bug that mixed up workspaces). `loadedWorkspaceIdRef` is set only when a
    // workspace's content is actually rendered, so this blocks the stale write
    // until the new workspace has loaded. Local-only (signed-out) mode is unaffected.
    if (authUser && loadedWorkspaceIdRef.current !== activeLocalWorkspaceId) {
      console.warn('⏭️ Skipping save — data not yet loaded for active workspace:', activeLocalWorkspaceId);
      return;
    }
    if (authUser && cloudPreviewWorkspaceRef.current === activeLocalWorkspaceId) {
      console.warn('⏭️ Skipping save — signed-in view is only a local cache preview:', activeLocalWorkspaceId);
      setSyncState((s) => ({ ...s, firebaseStatus: "Waiting for Firebase source" }));
      return;
    }
    try {
      const local = persistWorkspaceLocallyNow(activeLocalWorkspaceId, data, signedInUnsynced ? "instant-pending-cloud-save" : "instant-local-save", lastRemoteUpdatedAtRef.current || "");
      if (!window.WorkspaceStore?.canSave() && local.workspaces) setLocalWorkspaces(local.workspaces);
      if (local.backup) setSyncState((s) => ({ ...s, backupStatus: `Safety backup ${new Date(local.backup.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}` }));
    } catch {}
    if (signedInUnsynced && !uneditedCloudPreview && window.WorkspaceFirebaseSync?.saveWorkspaceDraft) {
      const baseUpdatedAt = lastRemoteUpdatedAtRef.current || "";
      draftSaveTimer.current = setTimeout(() => {
        window.WorkspaceFirebaseSync.saveWorkspaceDraft(activeLocalWorkspaceId, data, localSaveIdRef.current, { baseUpdatedAt })
          .then((saved) => {
            if (saved) setSyncState((s) => ({ ...s, backupStatus: `Cloud safety draft ${new Date(saved.saved_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}` }));
          })
          .catch(() => {});
      }, FIREBASE_DRAFT_SAVE_DELAY_MS);
    }
    saveTimer.current = setTimeout(() => {
      try {
        const local = persistWorkspaceLocallyNow(activeLocalWorkspaceId, data, "autosave", lastRemoteUpdatedAtRef.current || "");
        if (!window.WorkspaceStore?.canSave() && local.workspaces) setLocalWorkspaces(local.workspaces);
      } catch {}

      // ── Remote-apply guard ──────────────────────────────────────────────
      // If this `data` is the exact object we just applied FROM a remote Firebase
      // update, do NOT push it back to the cloud (that caused the infinite
      // A→B→A re-save loop). localStorage above still ran, so the local cache is
      // fresh. Any real local edit produces a new object and pushes normally.
      if (data === lastRemoteDataRef.current) {
        console.log('ℹ️ Skipping cloud re-push of remote-applied data (loop guard)');
        return;
      }

      // Save to Supabase if configured (existing remote save)
      if (window.WorkspaceStore?.canSave() && remoteReady.current) {
        window.WorkspaceStore.save(data).catch((error) => {
          setSyncState((s) => ({ ...s, error: error.message, status: "Sync failed" }));
        });
      }

      // Save to Firebase (non-blocking, async) — include session saveId so listener can skip echo
      if (window.WorkspaceFirebaseSync?.saveWorkspace) {
        // Mark save in-flight so the listener skips any incoming remote updates
        // that race against this save (old data from another session/tab).
        pendingLocalSaveRef.current = true;
        setSyncState((s) => ({ ...s, error: "", firebaseStatus: "Saving to cloud…" }));
        const activeWorkspaceMeta = (readJson(LOCAL_WORKSPACES_KEY, []) || []).find((workspace) => workspace.id === activeLocalWorkspaceId) || {};
        const baseUpdatedAt = lastRemoteUpdatedAtRef.current || "";
        window.WorkspaceFirebaseSync.saveWorkspace(activeLocalWorkspaceId, data, localSaveIdRef.current, {
          name: activeWorkspaceMeta.name || activeLocalWorkspaceId,
          visibility: activeWorkspaceMeta.visibility || "shared",
          ownerUid: activeWorkspaceMeta.ownerUid || "",
          ownerEmail: activeWorkspaceMeta.ownerEmail || "",
          baseUpdatedAt,
        })
          .then(async (saved) => {
            if (!firebaseSaveSucceeded(saved)) {
              pendingLocalSaveRef.current = false;
              if (authUser && window.WorkspaceFirebaseSync?.loadWorkspace && baseUpdatedAt) {
                try {
                  const rec = await window.WorkspaceFirebaseSync.loadWorkspace(activeLocalWorkspaceId);
                  if (rec?.workspace && latestSaveRef.current?.ws === activeLocalWorkspaceId) {
                    const remote = restoreRememberedPage(activeLocalWorkspaceId, normalizeWorkspaceData(rec.workspace));
                    setData((current) => {
                      const next = { ...remote, currentPageId: current.currentPageId };
                      lastRemoteDataRef.current = next;
                      lastRemoteUpdatedAtRef.current = rec.updated_at || new Date().toISOString();
                      cloudPreviewWorkspaceRef.current = null;
                      loadedWorkspaceIdRef.current = activeLocalWorkspaceId;
                      try {
                        localStorage.setItem(localWorkspaceDataKey(activeLocalWorkspaceId), JSON.stringify(next));
                        localStorage.setItem(`${activeLocalWorkspaceId}_local_saved_at`, lastRemoteUpdatedAtRef.current);
                      } catch {}
                      return next;
                    });
                    setSyncState((s) => ({ ...s, firebaseStatus: "Loaded newer Firebase revision" }));
                    return;
                  }
                } catch {}
              }
              setSyncState((s) => ({ ...s, error: firebaseSaveFailureMessage(saved), firebaseStatus: firebaseSaveFailureMessage(saved, authUser ? 'Cloud sync failed' : 'Sign in to sync') }));
              return;
            }
            // Save confirmed: update the remote base to the current state so
            // the listener's local-edit guard works correctly for future updates.
            // latestSaveRef.current.data tracks the latest render's data (may be
            // ahead of `data` if the user kept typing during the async save).
            lastRemoteDataRef.current = latestSaveRef.current?.data ?? data;
            lastRemoteUpdatedAtRef.current = saved.updated_at || new Date().toISOString();
            cloudPreviewWorkspaceRef.current = null;
            cloudPreviewDataRef.current = null;
            clearPendingWorkspaceDraft(activeLocalWorkspaceId);
            window.WorkspaceFirebaseSync?.clearWorkspaceDraft?.(activeLocalWorkspaceId);
            pendingLocalSaveRef.current = false;
            console.log('✅ Saved to Firebase');
            setSyncState((s) => ({ ...s, firebaseStatus: 'Synced to cloud ✓' }));
          })
          .catch((err) => {
            pendingLocalSaveRef.current = false;
            console.warn('⚠️ Firebase save failed (non-blocking):', err.message);
            setSyncState((s) => ({ ...s, firebaseStatus: 'Cloud sync failed' }));
          });
      }
    }, FIREBASE_CANONICAL_SAVE_DELAY_MS);
    return () => {
      clearTimeout(saveTimer.current);
      clearTimeout(draftSaveTimer.current);
    };
  }, [data, activeLocalWorkspaceId]);

  // ── Flush-on-exit guard ──────────────────────────────────────────────────
  // The save above is debounced 200ms. If the tab is closed or backgrounded within
  // that window the last keystrokes are lost. Keep the latest data/workspace in refs
  // and write localStorage SYNCHRONOUSLY on pagehide/visibilitychange (async cloud
  // saves can't reliably finish during unload, but localStorage can).
  const latestSaveRef = useRef({ data, ws: activeLocalWorkspaceId });
  latestSaveRef.current = { data, ws: activeLocalWorkspaceId };
  useEffect(() => {
    const flush = () => {
      try {
        const { data: d, ws } = latestSaveRef.current;
        if (skipPersistenceWorkspaceRef.current === ws) return;
        persistWorkspaceLocallyNow(ws, d, "pagehide-pending-cloud-save", lastRemoteUpdatedAtRef.current || "");
        if (authUser?.uid && d?.pages && d !== lastRemoteDataRef.current && !isWorkspaceUnavailableData(d)) {
          writePendingWorkspaceDraft(ws, d, lastRemoteUpdatedAtRef.current || "");
          window.WorkspaceFirebaseSync?.saveWorkspaceDraft?.(ws, d, localSaveIdRef.current, { baseUpdatedAt: lastRemoteUpdatedAtRef.current || "" });
        }
      } catch {}
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // ── Catch-up resync (reliability: you should NEVER need to reload) ──────────
  // The realtime listener intentionally SKIPS incoming edits while you have unsaved
  // local changes or a save is in flight. If a save fails or an update lands during
  // that window, the live listener won't re-fetch it, so you can silently fall
  // behind teammates' edits until a manual reload. This safety net re-checks
  // Firebase when the tab regains focus and on a slow interval, and:
  //   • if we have un-pushed local edits → re-push them (unsticks a failed save), or
  //   • if we're in sync → adopt anything newer the listener missed.
  // It only ever runs when idle (no save in flight) and never clobbers active typing
  // (it bails the moment `data` differs from the last confirmed remote base).
  useEffect(() => {
    if (!authUser?.uid || !activeLocalWorkspaceId) return;
    const fb = window.WorkspaceFirebaseSync;
    if (!fb?.loadWorkspace || !fb?.saveWorkspace) return;
    let cancelled = false;

    const catchUp = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      if (pendingLocalSaveRef.current) return;
      if (loadedWorkspaceIdRef.current !== activeLocalWorkspaceId) return;
      if (cloudPreviewWorkspaceRef.current === activeLocalWorkspaceId) return;
      if (skipPersistenceWorkspaceRef.current === activeLocalWorkspaceId) return;
      const cur = latestSaveRef.current?.data;
      if (!cur || isWorkspaceUnavailableData(cur)) return;

      // (1) Un-pushed local edits (e.g. a prior save failed) → re-push so the cloud
      //     and the listener's local-edit guard re-sync. We push OUR data, so no
      //     local work is lost.
      if (cur !== lastRemoteDataRef.current) {
        try {
          pendingLocalSaveRef.current = true;
          const meta = (readJson(LOCAL_WORKSPACES_KEY, []) || []).find((w) => w.id === activeLocalWorkspaceId) || {};
          const ok = await fb.saveWorkspace(activeLocalWorkspaceId, cur, localSaveIdRef.current, {
            name: meta.name || activeLocalWorkspaceId,
            visibility: meta.visibility || "shared",
            ownerUid: meta.ownerUid || "",
            ownerEmail: meta.ownerEmail || "",
            baseUpdatedAt: lastRemoteUpdatedAtRef.current || "",
          });
          pendingLocalSaveRef.current = false;
          if (firebaseSaveSucceeded(ok) && !cancelled) {
            lastRemoteDataRef.current = latestSaveRef.current?.data ?? cur;
            lastRemoteUpdatedAtRef.current = ok.updated_at || new Date().toISOString();
            cloudPreviewWorkspaceRef.current = null;
            cloudPreviewDataRef.current = null;
            clearPendingWorkspaceDraft(activeLocalWorkspaceId);
            fb.clearWorkspaceDraft?.(activeLocalWorkspaceId);
            setSyncState((s) => ({ ...s, firebaseStatus: "Synced to cloud ✓" }));
          }
        } catch { pendingLocalSaveRef.current = false; }
        return;
      }

      // (2) We're in sync → re-read Firebase and adopt anything the live listener
      //     may have missed (an update that landed during one of our saves).
      try {
        const rec = await fb.loadWorkspace(activeLocalWorkspaceId);
        if (cancelled || !rec?.workspace) return;
        if (rec.saveId && rec.saveId === localSaveIdRef.current) return; // our own latest write
        const remote = normalizeWorkspaceData(rec.workspace);
        setData((current) => {
          if (current !== lastRemoteDataRef.current) return current; // a local edit started — abort
          const next = { ...remote, currentPageId: current.currentPageId };
          if (JSON.stringify(next) === JSON.stringify(current)) return current; // nothing new
          lastRemoteDataRef.current = next;
          lastRemoteUpdatedAtRef.current = rec.updated_at || new Date().toISOString();
          cloudPreviewWorkspaceRef.current = null;
          loadedWorkspaceIdRef.current = activeLocalWorkspaceId;
          try {
            localStorage.setItem(localWorkspaceDataKey(activeLocalWorkspaceId), JSON.stringify(next));
            localStorage.setItem(`${activeLocalWorkspaceId}_local_saved_at`, lastRemoteUpdatedAtRef.current);
          } catch {}
          console.log("🔄 Catch-up resync applied a missed remote update");
          return next;
        });
      } catch {}
    };

    const onFocus = () => { if (document.visibilityState === "visible") catchUp(); };
    const timer = setInterval(catchUp, 15000);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [authUser?.uid, activeLocalWorkspaceId]);

  const currentPage = data.pages[data.currentPageId];

  // === Page operations ===
  const setCurrentPage = (id) => {
    rememberLocalPage(activeLocalWorkspaceId, id);
    setData(d => ({ ...d, currentPageId: id }));
  };
  useEffect(() => {
    if (data.currentPageId && data.pages?.[data.currentPageId]) {
      rememberLocalPage(activeLocalWorkspaceId, data.currentPageId);
    }
  }, [activeLocalWorkspaceId, data.currentPageId]);

  // Calendar events are part of the workspace data, so they ride the existing
  // localStorage + Firebase sync for free. mutator: (events) => nextEvents
  const updateEvents = (mutator) => setData(d => {
    const cur = d.events || {};
    const next = typeof mutator === "function" ? mutator(cur) : mutator;
    return { ...d, events: next || {} };
  });

  useEffect(() => {
    window.WaultRecovery = {
      activeWorkspaceId: activeLocalWorkspaceId,
      listVersions: (limit = 25) => window.WorkspaceFirebaseSync?.listWorkspaceVersions?.(activeLocalWorkspaceId, limit) || Promise.resolve([]),
      restoreVersion: async (versionId) => {
        if (!versionId || !window.WorkspaceFirebaseSync?.restoreWorkspaceVersion) return false;
        if (!confirm(`Restore workspace ${activeLocalWorkspaceId} to version ${versionId}? This will create a new version first.`)) return false;
        setSyncState((s) => ({ ...s, error: "", firebaseStatus: "Restoring version…" }));
        const restored = await window.WorkspaceFirebaseSync.restoreWorkspaceVersion(activeLocalWorkspaceId, versionId);
        if (!firebaseSaveSucceeded(restored)) {
          setSyncState((s) => ({ ...s, error: firebaseSaveFailureMessage(restored, "Restore failed"), firebaseStatus: "Restore failed" }));
          return false;
        }
        const rec = await window.WorkspaceFirebaseSync.loadWorkspace(activeLocalWorkspaceId);
        if (rec?.workspace) {
          const next = restoreRememberedPage(activeLocalWorkspaceId, normalizeWorkspaceData(rec.workspace));
          lastRemoteDataRef.current = next;
          lastRemoteUpdatedAtRef.current = rec.updated_at || new Date().toISOString();
          setData(next);
          persistWorkspaceLocallyNow(activeLocalWorkspaceId, next, "restored-version", lastRemoteUpdatedAtRef.current);
        }
        setSyncState((s) => ({ ...s, error: "", firebaseStatus: "Saved ✓" }));
        return true;
      },
    };
    return () => {
      if (window.WaultRecovery?.activeWorkspaceId === activeLocalWorkspaceId) delete window.WaultRecovery;
    };
  }, [activeLocalWorkspaceId]);

  // Focus→Main half of the bidirectional task sync: flip a checklist item by
  // (pageId, itemId) through normal state so it rides the save pipeline
  // (localStorage + Firebase + undo + cross-tab). Block id isn't known to the
  // caller (Focus sourceIds are wsId:pageId:itemId), so scan checklist blocks.
  const removeChecklistItemFromWorkspaceData = (sourceData, pageId, itemId) => {
    const page = sourceData?.pages?.[pageId];
    if (!page || !Array.isArray(page.blocks)) return { data: sourceData, found: false };
    let found = false;
    const blocks = page.blocks.map((b) => {
      if (b.type !== "checklist" || !Array.isArray(b.items)) return b;
      if (!b.items.some((i) => i && i.id === itemId)) return b;
      found = true;
      return { ...b, items: b.items.filter((i) => !(i && i.id === itemId)) };
    });
    if (!found) return { data: sourceData, found: false };
    return { data: { ...sourceData, pages: { ...sourceData.pages, [pageId]: { ...page, blocks } } }, found: true };
  };

  const completeChecklistItem = (pageId, itemId, done) => setData(d => {
    const page = d.pages[pageId];
    if (!page || !Array.isArray(page.blocks)) return d;
    let found = false;
    const blocks = page.blocks.map((b) => {
      if (b.type !== "checklist" || !Array.isArray(b.items)) return b;
      if (!b.items.some((i) => i && i.id === itemId)) return b;
      found = true;
      return { ...b, items: b.items.map((i) => i && i.id === itemId ? { ...i, done: !!done } : i) };
    });
    return found ? { ...d, pages: { ...d.pages, [pageId]: { ...page, blocks } } } : d;
  });

  const deleteChecklistItem = async (pageId, itemId) => {
    const before = latestSaveRef.current?.data || data;
    const removed = removeChecklistItemFromWorkspaceData(before, pageId, itemId);
    if (!removed.found) return true;
    const nextData = removed.data;
    setData(nextData);
    try {
      persistWorkspaceLocallyNow(activeLocalWorkspaceId, nextData, "focus-linked-task-delete", lastRemoteUpdatedAtRef.current || "");
    } catch {}
    if (!(authUser?.uid && userAccess && window.WorkspaceFirebaseSync?.saveWorkspace)) return true;

    try {
      pendingLocalSaveRef.current = true;
      const activeWorkspaceMeta = (readJson(LOCAL_WORKSPACES_KEY, []) || []).find((workspace) => workspace.id === activeLocalWorkspaceId) || {};
      const saved = await window.WorkspaceFirebaseSync.saveWorkspace(activeLocalWorkspaceId, nextData, localSaveIdRef.current, {
        name: activeWorkspaceMeta.name || activeLocalWorkspaceId,
        visibility: activeWorkspaceMeta.visibility || "shared",
        ownerUid: activeWorkspaceMeta.ownerUid || "",
        ownerEmail: activeWorkspaceMeta.ownerEmail || "",
        baseUpdatedAt: lastRemoteUpdatedAtRef.current || "",
          });
      pendingLocalSaveRef.current = false;
      if (!firebaseSaveSucceeded(saved)) {
        setData(before);
        setSyncState((s) => ({ ...s, error: firebaseSaveFailureMessage(saved), firebaseStatus: firebaseSaveFailureMessage(saved, "Task delete failed") }));
        return false;
      }
      lastRemoteDataRef.current = nextData;
      lastRemoteUpdatedAtRef.current = saved.updated_at || new Date().toISOString();
      cloudPreviewWorkspaceRef.current = null;
      cloudPreviewDataRef.current = null;
      clearPendingWorkspaceDraft(activeLocalWorkspaceId);
      setSyncState((s) => ({ ...s, firebaseStatus: "Synced to cloud ✓" }));
      return true;
    } catch (err) {
      pendingLocalSaveRef.current = false;
      setData(before);
      console.warn("⚠️ Checklist item delete failed:", err.message);
      setSyncState((s) => ({ ...s, firebaseStatus: "Task delete failed" }));
      return false;
    }
  };

  const updatePage = (id, patch) => setData(d => {
    const current = d.pages[id];
    const resolvedPatch = typeof patch === 'function' ? patch(current) : patch;
    const nextPage = { ...current, ...resolvedPatch };
    if (current && !current.system && Object.prototype.hasOwnProperty.call(resolvedPatch, "blocks")) {
      nextPage.blocks = ensureTrailingTextBlock(resolvedPatch.blocks);
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
      const pages = { ...d.pages, [id]: newPage };
      const next = { ...d, pages, currentPageId: id };
      if (parentId) {
        next.childOrder = { ...d.childOrder, [parentId]: [...(d.childOrder[parentId] || []), id] };
        // Notion-style: drop a clickable link to the new sub-page inside the parent's body.
        const parent = d.pages[parentId];
        if (parent && !parent.system && Array.isArray(parent.blocks)) {
          const linkBlock = { id: window.nid(), type: "subpage", pageId: id };
          const body = [...parent.blocks];
          // Insert before a trailing blank text block (so the cursor line stays last), else append.
          const last = body[body.length - 1];
          const lastBlank = last && last.type === "text" && !(window.stripHtml ? window.stripHtml(last.text || "") : (last.text || "")).trim();
          if (lastBlank) body.splice(body.length - 1, 0, linkBlock);
          else body.push(linkBlock);
          pages[parentId] = { ...parent, blocks: body };
        }
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
      return ensureParentSubpageLinks({ ...d, pages: newPages, rootOrder: newRootOrder, childOrder: newChildOrder, currentPageId: newRootId });
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
      // Remove any subpage link blocks that point to a deleted page (Notion-style cleanup).
      Object.keys(newPages).forEach((pid) => {
        const pg = newPages[pid];
        if (!Array.isArray(pg.blocks)) return;
        if (!pg.blocks.some((b) => b.type === "subpage" && toDelete.has(b.pageId))) return;
        newPages[pid] = { ...pg, blocks: pg.blocks.filter((b) => !(b.type === "subpage" && toDelete.has(b.pageId))) };
      });
      const newRoot = d.rootOrder.filter(pid => !toDelete.has(pid));
      const newCO = {};
      Object.entries(d.childOrder || {}).forEach(([k, arr]) => {
        if (toDelete.has(k)) return;
        newCO[k] = arr.filter(pid => !toDelete.has(pid));
      });
      const newCurrent = toDelete.has(d.currentPageId) ? (newRoot[0] || Object.keys(newPages)[0]) : d.currentPageId;
      return ensureParentSubpageLinks({ ...d, pages: newPages, rootOrder: newRoot, childOrder: newCO, currentPageId: newCurrent });
    });
  };

  const renamePage = (id, title) => updatePage(id, { title });

  // ── Pin / unpin pages ──────────────────────────────────────────────────────
  const pinPage = (id) => setData(d => ({
    ...d, pinnedPages: [...new Set([...(d.pinnedPages || []), id])]
  }));
  const unpinPage = (id) => setData(d => ({
    ...d, pinnedPages: (d.pinnedPages || []).filter(pid => pid !== id)
  }));

  // ── Cross-workspace paste ──────────────────────────────────────────────────
  // Creates a new root-level page from data stored in window._waultCopiedPageData.
  // Because the data is on window (not React state), it survives workspace switches.
  const pasteExternalPage = () => {
    const src = window._waultCopiedPageData;
    if (!src) return;
    const newId = "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    const cloneBlocks = (blocks) => (blocks || []).map(b => ({
      ...JSON.parse(JSON.stringify(b)),
      id: window.nid ? window.nid() : ("b_" + Math.random().toString(36).slice(2, 10)),
    }));
    const newPage = {
      id: newId,
      parentId: null,
      title: src.title || "Untitled",
      icon: src.icon || randomPageIcon(),
      date: src.date || "",
      blocks: cloneBlocks(src.blocks),
    };
    setData(d => {
      const pages = { ...d.pages, [newId]: newPage };
      const rootOrder = [...d.rootOrder, newId];
      return { ...d, pages, rootOrder, currentPageId: newId };
    });
  };

  // ── Workspace privacy (owner-only) ─────────────────────────────────────────
  const setWorkspacePrivacy = (isPrivate) => setData(d => ({
    ...d, settings: { ...(d.settings || {}), isPrivate: !!isPrivate }
  }));

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
      return ensureParentSubpageLinks({ ...d, pages: newPages, rootOrder: newRoot, childOrder: newCO });
    });
  };

  // === Block operations ===
  const updateBlock = (block) => {
    setData(d => {
      const pageId = d.currentPageId;
      const page = d.pages[pageId];
      if (!page) return d;
      const blocks = (page.blocks || []).map(b => b.id === block.id ? block : b);
      const nextPage = { ...page, blocks: page.system ? blocks : ensureTrailingTextBlock(blocks) };
      return { ...d, pages: { ...d.pages, [pageId]: nextPage } };
    });
  };
  const patchBlock = (blockId, updater) => {
    setData(d => {
      const pageId = d.currentPageId;
      const page = d.pages[pageId];
      if (!page) return d;
      const blocks = (page.blocks || []).map(b => b.id === blockId ? updater(b) : b);
      const nextPage = { ...page, blocks: page.system ? blocks : ensureTrailingTextBlock(blocks) };
      return { ...d, pages: { ...d.pages, [pageId]: nextPage } };
    });
  };
  const deleteBlock = (blockId) => {
    // Guard: a sub-page LINK can't be removed while the sub-page still exists.
    // (Deleting the link would orphan the page / it would just reappear on next sync.)
    // The link only goes away when the sub-page itself is deleted. A dead link
    // (target page already gone) CAN be removed to clean up.
    const pg = data.pages?.[data.currentPageId];
    const target = (pg?.blocks || []).find(b => b.id === blockId);
    if (target?.type === 'subpage' && data.pages?.[target.pageId]) {
      const sub = data.pages[target.pageId];
      const subTitle = (window.stripHtml ? window.stripHtml(sub.title || '') : (sub.title || '')).trim() || 'this sub-page';
      alert(`This is a link to the sub-page "${subTitle}".\n\nTo remove it, delete the sub-page itself — open it (or right-click it in the sidebar) and choose Delete. The link disappears automatically when the sub-page is gone.`);
      return;
    }
    setData(d => {
      const pageId = d.currentPageId;
      const page = d.pages[pageId];
      if (!page) return d;
      const next = (page.blocks || []).filter(b => b.id !== blockId);
      const nextPage = { ...page, blocks: ensureTrailingTextBlock(next.length ? next : [createTextBlock()]) };
      return { ...d, pages: { ...d.pages, [pageId]: nextPage } };
    });
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
    // "slot" means the dragged block takes the target block's original visual
    // slot. This matches the drop-box behaviour: V dropped on X => A/B/X/V,
    // and A dropped on C => B/C/A/D. Keep before/after for any legacy callers.
    let insertAt;
    if (position === "slot") {
      insertAt = to;
    } else {
      insertAt = position === "after" ? to + 1 : to;
      if (from < insertAt) insertAt -= 1;
    }
    blocks.splice(Math.max(0, Math.min(insertAt, blocks.length)), 0, moved);
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
  const createWorkspace = async (rawName, visibility = "shared") => {
    const name = (rawName || "").trim();
    if (!name) return;
    const defaultData = createEmptyWorkspace();
    return createWorkspaceFromData(name, defaultData, visibility);
  };

  const createWorkspaceFromData = async (rawName, workspaceData, visibility = "shared") => {
    const name = (rawName || "").trim() || "Imported workspace";
    const defaultData = normalizeWorkspaceData(workspaceData || createEmptyWorkspace());
    const normalizedVisibility = visibility === "private" ? "private" : "shared";
    if (authUser?.uid && userAccess && window.WorkspaceFirebaseSync?.saveWorkspace) {
      const id = createCloudWorkspaceId();
      const nowIso = new Date().toISOString();
      const workspace = {
        id,
        name,
        visibility: normalizedVisibility,
        ownerUid: authUser.uid,
        ownerEmail: (authUser.email || userAccess.email || "").toLowerCase(),
        updatedAt: nowIso,
        createdAt: nowIso,
      };
      const nextWorkspaces = [...localWorkspaces, workspace];
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Creating workspace" }));
      try {
        const saved = await window.WorkspaceFirebaseSync.saveWorkspace(id, defaultData, localSaveIdRef.current, workspace);
        if (!firebaseSaveSucceeded(saved)) throw new Error(firebaseSaveFailureMessage(saved, "Firebase rejected the workspace save."));
        untombstoneWorkspace(id);
        localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
        localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, id);
        localStorage.setItem(localWorkspaceDataKey(id), JSON.stringify(defaultData));
        skipPersistenceWorkspaceRef.current = null;
        lastRemoteDataRef.current = defaultData;
        lastRemoteUpdatedAtRef.current = saved.updated_at || nowIso;
        cloudPreviewWorkspaceRef.current = null;
        cloudPreviewDataRef.current = null;
        clearPendingWorkspaceDraft(id);
        loadedWorkspaceIdRef.current = id;   // this workspace's content is now what's loaded
        setLocalWorkspaces(nextWorkspaces);
        setActiveLocalWorkspaceId(id);
        setData(defaultData);
        setSyncState((s) => ({
          ...s,
          busy: false,
          error: "",
          workspaceId: id,
          workspaceName: name,
          workspaces: nextWorkspaces,
          status: normalizedVisibility === "private" ? "Private workspace saved to Firebase" : "Shared workspace saved to Firebase",
          firebaseStatus: "Synced to cloud ✓",
        }));
      } catch (error) {
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Create failed" }));
        alert(error.message || "Workspace creation failed. Please try again.");
      }
      return;
    }

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
    const workspace = { id, name, visibility: normalizedVisibility, updatedAt: new Date().toISOString() };
    const nextWorkspaces = [...localWorkspaces, workspace];
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
    localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, id);
    localStorage.setItem(localWorkspaceDataKey(id), JSON.stringify(defaultData));
    loadedWorkspaceIdRef.current = id;
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

    // Firebase workspace discovery is catalogue-backed, so deletion must reach
    // Firebase before we remove the browser copy. The API bridge is only an
    // optional cleanup path now; lack of a Railway/API key must not block UI
    // deletion for signed-in users.
    if (authUser && userAccess) {
      // Cancel any pending save debounce for this workspace before contacting the server.
      // Without this, an in-flight browser→Firebase write can complete after the server
      // has already removed the workspace, resurrecting it for every other device.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Deleting workspace" }));
      try {
        if (!window.WorkspaceFirebaseSync?.removeWorkspace) {
          throw new Error("Firebase workspace deletion is unavailable. Please reload and try again.");
        }
        await window.WorkspaceFirebaseSync.removeWorkspace(id);
        // Optional: keep the MCP/Railway bridge catalogue tidy when available,
        // but do not fail the user-facing delete if this background cleanup fails.
        if (window.WorkspaceApiBridge?.deleteWorkspace) {
          Promise.resolve(window.WorkspaceApiBridge.deleteWorkspace(id)).catch((error) => {
            console.warn("⚠️ API bridge workspace cleanup failed:", error.message);
          });
        }
      } catch (error) {
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Delete failed" }));
        alert(error.message || "Workspace deletion failed. Please try again.");
        return;
      }
    }

    // Tombstone the id so neither the seed-init nor the server discovery merge
    // resurrects it on the next reload.
    tombstoneWorkspace(id);
    const nextWorkspaces = workspaceList.filter((item) => item.id !== id);
    const nextActive = id === activeLocalWorkspaceId
      ? nextWorkspaces[0]
      : (nextWorkspaces.find((item) => item.id === activeLocalWorkspaceId) || nextWorkspaces[0]);
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
    cleanupLocalWorkspaceArtifacts(id);
    localStorage.setItem(LOCAL_ACTIVE_WORKSPACE_KEY, nextActive.id);
    skipPersistenceWorkspaceRef.current = id;
    pendingLocalSaveRef.current = false;
    if (loadedWorkspaceIdRef.current === id) loadedWorkspaceIdRef.current = nextActive.id;
    window.WaultFocusCleanup?.deleteWorkspaceTasks?.(id, {
      fb: window.WorkspaceFirebaseSync,
      uid: authUser?.uid,
    });
    const nextData = loadLocalWorkspaceData(nextActive.id);
    setLocalWorkspaces(nextWorkspaces);
    setActiveLocalWorkspaceId(nextActive.id);
    setData(nextData);
    setSyncState((s) => ({
      ...s,
      workspaceId: nextActive.id,
      workspaceName: nextActive.name,
      workspaces: nextWorkspaces,
      busy: false,
      status: authUser && userAccess ? "Synced" : "Local draft",
    }));
  };

  const updateWorkspaceVisibility = async (id, visibility) => {
    const normalizedVisibility = visibility === "private" ? "private" : "shared";
    if (!id) return;
    const workspace = (localWorkspaces || []).find((item) => item.id === id) || {};

    if (authUser?.uid && userAccess && window.WorkspaceFirebaseSync?.updateWorkspaceCatalog) {
      const isAppOwner = userAccess.role === "owner";
      const isWorkspaceOwner = !workspace.ownerUid || workspace.ownerUid === authUser.uid;
      if (!isAppOwner && !isWorkspaceOwner) {
        alert("Only the workspace creator or owner can change this workspace visibility.");
        return;
      }
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Updating workspace visibility" }));
      try {
        const meta = await window.WorkspaceFirebaseSync.updateWorkspaceCatalog(id, {
          ...workspace,
          visibility: normalizedVisibility,
          ownerUid: workspace.ownerUid || authUser.uid,
          ownerEmail: workspace.ownerEmail || (authUser.email || userAccess.email || "").toLowerCase(),
        });
        const nextWorkspaces = localWorkspaces.map((item) => (
          item.id === id
            ? { ...item, ...normalizeWorkspaceSummary({ ...item, ...meta, visibility: normalizedVisibility }) }
            : item
        ));
        localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
        setLocalWorkspaces(nextWorkspaces);
        setSyncState((s) => ({
          ...s,
          busy: false,
          error: "",
          workspaces: nextWorkspaces,
          status: normalizedVisibility === "private" ? "Workspace is now private" : "Workspace is now shared",
          firebaseStatus: "Team catalogue updated",
        }));
      } catch (error) {
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Visibility update failed" }));
        alert(error.message || "Workspace visibility update failed. Please try again.");
      }
      return;
    }

    const nextWorkspaces = localWorkspaces.map((item) => (
      item.id === id ? { ...item, visibility: normalizedVisibility, updatedAt: new Date().toISOString() } : item
    ));
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
    setLocalWorkspaces(nextWorkspaces);
    setSyncState((s) => ({ ...s, workspaces: nextWorkspaces, status: "Local draft" }));
  };

  const renameWorkspace = async (id, rawName) => {
    const name = (rawName || "").trim();
    if (!id || !name) return;

    if (authUser?.uid && userAccess && window.WorkspaceFirebaseSync?.updateWorkspaceCatalog) {
      setSyncState((s) => ({ ...s, busy: true, error: "", status: "Renaming workspace" }));
      try {
        const activeMeta = (localWorkspaces || []).find((workspace) => workspace.id === id) || {};
        const meta = await window.WorkspaceFirebaseSync.updateWorkspaceCatalog(id, {
          ...activeMeta,
          name,
        });
        const nextWorkspaces = localWorkspaces.map((workspace) => (
          workspace.id === id
            ? { ...workspace, ...normalizeWorkspaceSummary({ ...workspace, ...meta, name }) }
            : workspace
        ));
        localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(nextWorkspaces));
        setLocalWorkspaces(nextWorkspaces);
        const active = nextWorkspaces.find((workspace) => workspace.id === activeLocalWorkspaceId);
        setSyncState((s) => ({
          ...s,
          busy: false,
          error: "",
          workspaceName: active?.name || s.workspaceName,
          workspaces: nextWorkspaces,
          status: "Workspace renamed in Firebase",
          firebaseStatus: "Team catalogue updated",
        }));
      } catch (error) {
        setSyncState((s) => ({ ...s, busy: false, error: error.message, status: "Rename failed" }));
        alert(error.message || "Workspace rename failed. Please try again.");
      }
      return;
    }

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
    if (!id || id === activeLocalWorkspaceId) return;
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
    setSyncState((s) => ({ ...s, workspaceId: id, workspaceName: workspace.name, workspaces: localWorkspaces, status: authUser ? "Loading…" : "Local draft" }));

    if (authUser) {
      // Instant switch: render the cached copy right away (NO full-screen gate).
      // Changing activeLocalWorkspaceId re-runs the Firebase init effect, which
      // refreshes this workspace from the cloud and attaches the live listener.
      const cachedRaw = readJson(localWorkspaceDataKey(id), null);
      if (cachedRaw && cachedRaw.pages && !isWorkspaceUnavailableData(cachedRaw)) {
        if (skipPersistenceWorkspaceRef.current === id) skipPersistenceWorkspaceRef.current = null;
        lastRemoteDataRef.current = null;       // cache is not a confirmed remote base
        lastRemoteUpdatedAtRef.current = "";
        cloudPreviewWorkspaceRef.current = id;
        loadedWorkspaceIdRef.current = null;     // Firebase load is the only thing that unlocks autosave
        setData(restoreRememberedPage(id, normalizeWorkspaceData(cachedRaw)));
      }
      return;
    }

    // Signed-out / local-only mode.
    loadedWorkspaceIdRef.current = id;
    setData(loadLocalWorkspaceData(id));
    setSyncState((s) => ({ ...s, status: "Local draft" }));
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

  // ── Firebase Google Auth handlers ──────────────────────────────────────────
  const [googleSignInBusy, setGoogleSignInBusy] = useState(false);
  const [googleSignInError, setGoogleSignInError] = useState('');

  const signInWithGoogle = async () => {
    if (!window.WorkspaceFirebaseSync?.signInWithGoogle) return;
    setGoogleSignInBusy(true);
    setGoogleSignInError('');
    try {
      await window.WorkspaceFirebaseSync.signInWithGoogle();
      // onAuthStateChanged will fire → sets authUser + checks access
    } catch (err) {
      setGoogleSignInError(err.message || 'Sign-in failed. Try again.');
    } finally {
      setGoogleSignInBusy(false);
    }
  };

  const signOutFirebase = async () => {
    if (!window.WorkspaceFirebaseSync?.signOut) return;
    await window.WorkspaceFirebaseSync.signOut();
    setCloudCatalogueReady(false);
    setCloudWorkspaceLoading(false);
    setWorkspaceApiReady(false);
    // onAuthStateChanged fires → resets authUser / userAccess
  };

  const firebaseConfigured = !!(window.SUPABASE_CONFIG?.firebaseApiKey);
  // TEMP DEV PEEK — localhost-only auth bypass (inert on the live site). REMOVE
  // before the next production deploy. [[wault-dev-peek-localhost-bypass]]
  const DEV_PEEK = (() => {
    try {
      const h = window.location.hostname;
      const isLocal = h === "localhost" || h === "127.0.0.1" || h === "[::1]";
      return isLocal && new URLSearchParams(window.location.search).has("devpeek");
    } catch { return false; }
  })();
  const configured = window.WorkspaceStore?.isConfigured();
  const activeWorkspaceMeta = (localWorkspaces || []).find((workspace) => workspace.id === activeLocalWorkspaceId) || {};
  const cloudWorkspaceAllowed = !!(authUser?.uid && userAccess && !firebaseAccessDenied);
  const canCreateWorkspace = cloudWorkspaceAllowed || (!configured || syncState.role === "owner" || syncState.role === "admin");
  const canManageActiveWorkspace = cloudWorkspaceAllowed
    ? (userAccess.role === "owner" || !activeWorkspaceMeta.ownerUid || activeWorkspaceMeta.ownerUid === authUser.uid)
    : (!configured || syncState.role === "owner" || syncState.role === "admin");
  // Temporarily disabled for local testing
  // if (configured && !syncState.user) { ... }

  if (!firebaseConfigured && configured && syncState.user && syncState.accessDenied) {
    return (
      <AccessDeniedScreen
        syncState={syncState}
        onSignOut={signOut}
      />
    );
  }

  if (!firebaseConfigured && configured && syncState.user && !syncState.workspaceId) {
    return (
      <LoadingWorkspaceScreen
        syncState={syncState}
        onSignOut={signOut}
      />
    );
  }

  // ── Firebase Google Auth gates ─────────────────────────────────────────────
  if (!DEV_PEEK && firebaseConfigured && authLoading) {
    return (
      <main className="auth-gate">
        <section className="auth-card">
          <div className="auth-kicker">Loading</div>
          <h1>Connecting…</h1>
          <p>Checking your sign-in status.</p>
        </section>
      </main>
    );
  }

  if (!DEV_PEEK && firebaseConfigured && !authUser) {
    return (
      <GoogleSignInScreen
        busy={googleSignInBusy}
        error={googleSignInError}
        onSignIn={signInWithGoogle}
      />
    );
  }

  if (!DEV_PEEK && firebaseConfigured && authUser && firebaseAccessDenied) {
    return (
      <FirebaseAccessDeniedScreen
        email={authUser.email}
        onSignOut={signOutFirebase}
      />
    );
  }

  // The gate waits ONLY on the active workspace's content load (cold sign-in with
  // no local copy). It must NEVER depend on the team catalogue — that loads in the
  // background and a slow/failed catalogue read must not strand the user here.
  if (firebaseConfigured && authUser && userAccess && cloudWorkspaceLoading) {
    return (
      <LoadingWorkspaceScreen
        syncState={{ ...syncState, status: "Opening your workspace" }}
        onSignOut={signOutFirebase}
      />
    );
  }

  // Private workspace access is enforced by /workspaceCatalog visibility and
  // Firebase rules. The older data.settings.isPrivate flag is no longer used as
  // a client-side gate because it could hide shared team workspaces from members.

  return (
    <div className={`app ${tocCollapsed ? "toc-collapsed" : ""} ${mobileSidebarOpen ? "mobile-sidebar-open" : ""}`}>
      {mobileSidebarOpen && <div className="mobile-sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />}
      {/* App-level hamburger: present on every view (editor, Focus home, task index)
          so the sidebar drawer is always reachable on mobile. */}
      <button
        className="mobile-menu-btn"
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14"/>
        </svg>
      </button>
      <Sidebar
        onMobileClose={() => setMobileSidebarOpen(false)}
        data={data}
        setCurrentPage={setCurrentPage}
        addPage={addPage}
        deletePage={deletePage}
        duplicatePage={duplicatePage}
        renamePage={renamePage}
        movePage={movePage}
        pinPage={pinPage}
        unpinPage={unpinPage}
        pasteExternalPage={pasteExternalPage}
        setWorkspacePrivacy={setWorkspacePrivacy}
        exportData={exportData}
        importData={importData}
        syncState={syncState}
        onSignIn={signIn}
        onSignOut={signOut}
        onInviteMember={inviteMember}
        workspaces={syncState.user ? (syncState.workspaces || []) : localWorkspaces}
        activeWorkspaceId={syncState.user ? syncState.workspaceId : activeLocalWorkspaceId}
        onCreateWorkspace={createWorkspace}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={deleteWorkspaceById}
        onUpdateWorkspaceVisibility={updateWorkspaceVisibility}
        onSwitchWorkspace={switchWorkspace}
        canManageWorkspace={canManageActiveWorkspace}
        canCreateWorkspace={canCreateWorkspace}
        onUndo={performUndo}
        onRedo={performRedo}
        authUser={authUser}
        userAccess={userAccess}
        onFirebaseSignOut={signOutFirebase}
        onOpenHome={() => setCurrentPage(HOME_PAGE_ID)}
        homeActive={data.currentPageId === HOME_PAGE_ID}
      />
      {currentPage?.id === HOME_PAGE_ID ? (
        <window.FocusHome
          data={data}
          activeWorkspaceId={syncState.user ? syncState.workspaceId : activeLocalWorkspaceId}
          workspaces={syncState.user ? (syncState.workspaces || []) : localWorkspaces}
          deletedWorkspaceIds={[...getDeletedWorkspaceIds()]}
          authUser={authUser}
          switchWorkspace={switchWorkspace}
          setCurrentPage={setCurrentPage}
          completeChecklistItem={completeChecklistItem}
          deleteChecklistItem={deleteChecklistItem}
          cloudConnected={!!window.WorkspaceFirebaseSync}
        />
      ) : (
        <PageEditor
          page={currentPage}
          updatePage={updatePage}
          updateBlock={updateBlock}
          patchBlock={patchBlock}
          deleteBlock={deleteBlock}
          addBlock={addBlock}
          addBlockAfter={addBlockAfter}
          addBlockBefore={addBlockBefore}
          replaceBlock={replaceBlock}
          moveBlock={moveBlock}
          data={data}
          setCurrentPage={setCurrentPage}
          updateEvents={updateEvents}
          addPage={addPage}
          presenceLocks={{ ...presenceLocks, ...firebasePresence }}
          onWordBoundary={forceHistoryCommit}
          authUser={authUser}
          activeWorkspaceId={activeLocalWorkspaceId}
        />
      )}
      {currentPage?.id !== HOME_PAGE_ID && (
        <TableOfContents page={currentPage} collapsed={tocCollapsed} onToggle={() => setTocCollapsed((value) => !value)} />
      )}
    </div>
  );
}

// ====== SIDEBAR with drag-and-drop ======
// Default page icon — returned as a NEW element each call (JSX objects can't be shared)
const makeSidebarPageIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.5, display:'block'}}>
    <path d="M4 2h5.5L12 4.5V14H4V2z"/>
    <path d="M9 2v3h3"/>
  </svg>
);

function Sidebar({
  data, setCurrentPage, addPage, deletePage, duplicatePage, renamePage, movePage,
  pinPage, unpinPage, pasteExternalPage, setWorkspacePrivacy,
  exportData, importData,
  syncState, onSignIn, onSignOut, onInviteMember, workspaces, activeWorkspaceId,
  onCreateWorkspace, onRenameWorkspace, onDeleteWorkspace, onUpdateWorkspaceVisibility, onSwitchWorkspace, canManageWorkspace = false, canCreateWorkspace = false, onUndo, onRedo,
  authUser, userAccess, onFirebaseSignOut, onMobileClose, onOpenHome, homeActive,
}) {
  // Backup/restore is an owner-only operation; members never see the backup interface.
  const isOwner = userAccess?.role === 'owner';
  const [expanded, setExpanded] = useState(() => {
    return {};
  });
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // {parentId, index}
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [workspaceVisibilityDraft, setWorkspaceVisibilityDraft] = useState("shared");
  const [renamingWorkspace, setRenamingWorkspace] = useState(false);
  const [workspaceRenameDraft, setWorkspaceRenameDraft] = useState("");
  const dropCommittedRef = useRef(false);

  // ── Right-click context menu ──
  const [sidebarCtx, setSidebarCtx] = useState(null); // { x, y, pageId }
  const [renamingPageId, setRenamingPageId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const ctxMenuRef = useRef(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!sidebarCtx) return;
    const onDown = (e) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target)) setSidebarCtx(null);
    };
    const onKey = (e) => { if (e.key === "Escape") setSidebarCtx(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [sidebarCtx]);

  // Commit inline page rename
  const commitRename = (id) => {
    const title = renameDraft.trim() || "Untitled";
    renamePage?.(id, title);
    setRenamingPageId(null);
  };

  const openCtxMenu = (e, pageId) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 210);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    setSidebarCtx({ x, y, pageId });
  };

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
          onClick={() => { if (renamingPageId === page.id) return; setCurrentPage(page.id); onMobileClose?.(); }}
          onContextMenu={(e) => openCtxMenu(e, page.id)}
          title="Click to open · Right-click for options"
        >
          <span
            className="sidebar-drag-handle"
            onClick={(e) => e.stopPropagation()}
            title="Drag page"
          >
            ⋮⋮
          </span>
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(page.id); }}
              className="sidebar-toggle has-tip tip-sidebar-right"
              title={isExpanded ? "Collapse page" : "Expand page"}
              aria-label={isExpanded ? "Collapse page" : "Expand page"}
              data-tooltip={isExpanded ? "Collapse page" : "Expand page"}
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="sidebar-toggle-spacer" />
          )}
          <span className="sidebar-icon">{page.icon ? (window.renderPageIcon ? window.renderPageIcon(page.icon, 15) : page.icon) : makeSidebarPageIcon()}</span>
          {renamingPageId === page.id ? (
            <input
              className="sidebar-rename-input"
              value={renameDraft}
              autoFocus
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitRename(page.id);
                if (e.key === "Escape") setRenamingPageId(null);
              }}
              onBlur={() => commitRename(page.id)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="sidebar-title">{window.stripHtml ? window.stripHtml(page.title) : (page.title || "Untitled")}</span>
          )}
          {!page.system && (
            <div className="sidebar-actions">
              <button
                onClick={(e) => { e.stopPropagation(); addPage(page.id); setExpanded(x => ({ ...x, [page.id]: true })); }}
                title="Add subpage"
                aria-label="Add subpage"
                data-tooltip="Add subpage"
                className="sidebar-action-btn has-tip tip-sidebar-right"
              >
                +
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); duplicatePage?.(page.id); }}
                title="Duplicate page"
                aria-label="Duplicate page"
                data-tooltip="Duplicate page"
                className="sidebar-action-btn has-tip tip-sidebar-right"
              >
                ⧉
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                title="Delete page"
                aria-label="Delete page"
                data-tooltip="Delete page"
                className="sidebar-action-btn has-tip tip-sidebar-right"
              >
                ×
              </button>
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
  const activeVisibility = activeWorkspace?.visibility === "private" ? "private" : "shared";
  const activeVisibilityLabel = activeWorkspace?.visibility === "private"
    ? "private to me"
    : (authUser ? "public to team" : "public");
  const todayMeta = useMemo(() => formatWorkspaceDate(new Date()), []);
  const submitWorkspace = (e) => {
    e.preventDefault();
    const name = workspaceNameDraft.trim();
    if (!name) return;
    onCreateWorkspace(name, workspaceVisibilityDraft);
    setWorkspaceNameDraft("");
    setWorkspaceVisibilityDraft("shared");
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
  const toggleActiveWorkspaceVisibility = () => {
    if (!activeWorkspaceId || !canManageWorkspace || !onUpdateWorkspaceVisibility) return;
    const nextVisibility = activeVisibility === "private" ? "shared" : "private";
    onUpdateWorkspaceVisibility(activeWorkspaceId, nextVisibility);
  };

  return (
    <>
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="workspace-switcher">
          <span className="workspace-select-wrap has-tip tip-sidebar-right" data-tooltip="Switch workspace">
            <select
              className="workspace-select"
              value={activeWorkspaceId || ""}
              onChange={(e) => onSwitchWorkspace(e.target.value)}
              title="Switch workspace"
              aria-label="Switch workspace"
            >
              {(workspaces || []).map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspace.name}{workspace.visibility === "private" ? " · Private" : ""}</option>
              ))}
            </select>
          </span>
          <span className="workspace-tip-wrap has-tip tip-sidebar-right" data-tooltip="Edit workspace name">
            <button className="workspace-edit-btn" onClick={startRenamingWorkspace} disabled={!canManageWorkspace} title="Edit workspace name" aria-label="Edit workspace name" type="button">✎</button>
          </span>
          <span className="workspace-tip-wrap has-tip tip-sidebar-right" data-tooltip="New workspace">
            <button className="workspace-create-btn" onClick={() => { setRenamingWorkspace(false); setCreatingWorkspace((value) => !value); }} disabled={!canCreateWorkspace} title="New workspace" aria-label="New workspace" type="button">+</button>
          </span>
          <span className="workspace-tip-wrap has-tip tip-sidebar-right" data-tooltip="Delete workspace">
            <button className="workspace-delete-btn" onClick={() => onDeleteWorkspace?.(activeWorkspaceId)} disabled={!canManageWorkspace || (workspaces || []).length <= 1} title="Delete workspace" aria-label="Delete workspace" type="button">×</button>
          </span>
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
            <label className="workspace-visibility-option">
              <input
                type="radio"
                name="workspace-visibility"
                value="shared"
                checked={workspaceVisibilityDraft !== "private"}
                onChange={() => setWorkspaceVisibilityDraft("shared")}
              />
              <span>Shared with team</span>
            </label>
            <label className="workspace-visibility-option">
              <input
                type="radio"
                name="workspace-visibility"
                value="private"
                checked={workspaceVisibilityDraft === "private"}
                onChange={() => setWorkspaceVisibilityDraft("private")}
              />
              <span>Private to me</span>
            </label>
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
        <div className="workspace-sub">
          <span>{Object.keys(data.pages).length} pages · {activeVisibilityLabel}</span>
          {activeWorkspace && (
            <button
              className="workspace-visibility-toggle"
              type="button"
              disabled={!canManageWorkspace}
              onClick={toggleActiveWorkspaceVisibility}
              title={canManageWorkspace ? "Switch workspace visibility" : "Only the workspace creator or owner can change visibility"}
              aria-label={activeVisibility === "private" ? "Make workspace public" : "Make workspace private"}
            >
              {activeVisibility === "private" ? "Make public" : "Make private"}
            </button>
          )}
        </div>
      </div>
      <div className="sidebar-tree"
        onDragOver={(e) => {
          // bottom drop zone for root
          e.preventDefault();
        }}>
        {/* ── Home (Focus dashboard) — prominent top nav entry ── */}
        <button
          type="button"
          className={"sidebar-home-btn has-tip" + (homeActive ? " active" : "")}
          onClick={() => { onOpenHome?.(); onMobileClose?.(); }}
          title="Home — your Focus dashboard and workspaces"
          aria-label="Home — your Focus dashboard and workspaces"
          aria-current={homeActive ? "page" : undefined}
          data-tooltip="Home — your Focus dashboard and workspaces"
        >
          <span className="sidebar-home-icon">◎</span>
          <span className="sidebar-home-label">Home</span>
          <span className="sidebar-home-tag">Focus</span>
        </button>
        {/* ── Pinned pages ── */}
        {(data.pinnedPages || []).length > 0 && (() => {
          const pinnedPgs = (data.pinnedPages || []).map(id => data.pages[id]).filter(Boolean);
          if (!pinnedPgs.length) return null;
          return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "sidebar-section-label" }, "📌 Pinned"),
            ...pinnedPgs.map(pg =>
              React.createElement("div", {
                key: pg.id,
                className: "sidebar-pinned-item" + (data.currentPageId === pg.id ? " active" : ""),
                onClick: () => { setCurrentPage(pg.id); onMobileClose?.(); },
                title: window.stripHtml ? window.stripHtml(pg.title) : (pg.title || "Untitled"),
              },
                React.createElement("span", { style: { fontSize: 11, opacity: 0.6, flexShrink: 0 } }, "📌"),
                React.createElement("span", { className: "sidebar-icon" },
                  pg.icon ? (window.renderPageIcon ? window.renderPageIcon(pg.icon, 14) : pg.icon) : "📄"
                ),
                React.createElement("span", { className: "sidebar-title" },
                  window.stripHtml ? window.stripHtml(pg.title) : (pg.title || "Untitled")
                )
              )
            ),
            React.createElement("div", { className: "sidebar-pinned-sep" })
          );
        })()}
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
        <button onClick={() => addPage(null)} className="new-page-btn has-tip" title="Create new page" aria-label="Create new page" data-tooltip="Create new page">+ New page</button>
        <div className="sidebar-util">
          <button onClick={onUndo} className="util-btn has-tip" title="Undo" aria-label="Undo" data-tooltip="Undo">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>
          </button>
          <button onClick={onRedo} className="util-btn has-tip" title="Redo" aria-label="Redo" data-tooltip="Redo">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h1"/></svg>
          </button>
        </div>
        {authUser && userAccess && (
          <TeamPanel
            authUser={authUser}
            userAccess={userAccess}
            onSignOut={onFirebaseSignOut}
            activeWorkspaceId={activeWorkspaceId}
            exportData={exportData}
            importData={importData}
            syncState={syncState}
            onOpenHome={onOpenHome}
            homeActive={homeActive}
          />
        )}
      </div>
    </aside>

    {/* ── Sidebar right-click context menu portal ── */}
    {sidebarCtx && (() => {
      const pg = data.pages[sidebarCtx.pageId];
      if (!pg) return null;
      const isPinned = (data.pinnedPages || []).includes(pg.id);
      const copiedData = window._waultCopiedPageData;
      const menuItems = [
        {
          icon: "↗",
          label: "Open",
          action: () => { setCurrentPage(pg.id); onMobileClose?.(); setSidebarCtx(null); },
        },
        {
          icon: "✎",
          label: "Rename",
          action: () => {
            setSidebarCtx(null);
            setRenameDraft(window.stripHtml ? window.stripHtml(pg.title) : (pg.title || "Untitled"));
            setRenamingPageId(pg.id);
          },
        },
        {
          icon: isPinned ? "📌" : "📍",
          label: isPinned ? "Unpin from top" : "Pin to top",
          action: () => {
            if (isPinned) unpinPage?.(pg.id);
            else pinPage?.(pg.id);
            setSidebarCtx(null);
          },
        },
        { sep: true },
        {
          icon: "+",
          label: "Add subpage",
          action: () => { addPage(pg.id); setExpanded(x => ({ ...x, [pg.id]: true })); setSidebarCtx(null); },
        },
        {
          icon: "⧉",
          label: "Duplicate page",
          action: () => { duplicatePage?.(pg.id); setSidebarCtx(null); },
        },
        {
          icon: "⎘",
          label: "Copy page",
          action: () => {
            // Store full page data globally so it survives workspace switches
            window._waultCopiedPageData = JSON.parse(JSON.stringify(pg));
            setSidebarCtx(null);
          },
        },
        copiedData ? {
          icon: "⎗",
          label: `Paste "${window.stripHtml ? window.stripHtml(copiedData.title || "") : (copiedData.title || "page")}"`,
          action: () => {
            pasteExternalPage?.();
            setSidebarCtx(null);
          },
        } : null,
        { sep: true },
        !pg.system ? {
          icon: "🗑",
          label: "Delete",
          danger: true,
          action: () => { setSidebarCtx(null); deletePage(pg.id); },
        } : null,
      ].filter(Boolean);

      return ReactDOM.createPortal(
        <div
          ref={ctxMenuRef}
          className="sidebar-ctx-menu"
          style={{ left: sidebarCtx.x, top: sidebarCtx.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menuItems.map((item, i) =>
            item.sep ? (
              <div key={`sep-${i}`} className="sidebar-ctx-sep" />
            ) : (
              <button
                key={item.label}
                className={`sidebar-ctx-item${item.danger ? " danger" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={item.action}
              >
                <span className="sidebar-ctx-icon">{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body
      );
    })()}
  </>
  );
}

function SyncPanel({ syncState }) {
  const firebaseStatus = syncState.firebaseStatus || '';
  const lower = firebaseStatus.toLowerCase();
  const isSaving = lower.includes('saving') || lower.includes('restoring');
  const isSynced = firebaseStatus.includes('✓') || lower.includes('connected') || lower.includes('saved');
  const isFailed = lower.includes('failed') || lower.includes('offline') || lower.includes('blocked') || lower.includes('rejected') || lower.includes('skipped');
  if (!firebaseStatus) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'2px 0' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background: isSynced ? '#3dd68c' : isFailed ? '#f07070' : '#e8c460', boxShadow: isSynced ? '0 0 4px rgba(61,214,140,0.5)' : 'none' }} />
      <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'0.02em' }}>
        {isSynced ? 'Saved' : isFailed ? 'Failed' : isSaving ? 'Saving' : 'Checking'}
      </span>
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

// ====== PAGE ICON PICKER (premium line-icons + emoji) ======
function PageIconPicker({ icon, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [emoji, setEmoji] = React.useState("");
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const keys = window.PREMIUM_ICON_PATHS ? Object.keys(window.PREMIUM_ICON_PATHS) : [];
  const resolvedKey = window.resolveIconKey ? window.resolveIconKey(icon) : null;
  return (
    <div className="page-icon-wrap" ref={ref}>
      <button className="page-icon-btn" onClick={() => setOpen(o => !o)} title="Change icon" type="button">
        {resolvedKey
          ? (window.renderPageIcon ? window.renderPageIcon(resolvedKey, 44) : icon)
          : <span style={{ fontSize: 46, lineHeight: 1 }}>{icon || "📄"}</span>}
      </button>
      {open && (
        <div className="page-icon-popover">
          <div className="page-icon-grid">
            {keys.map(k => (
              <button
                key={k}
                className={`page-icon-cell ${(resolvedKey || icon) === k ? "active" : ""}`}
                onClick={() => { onChange(k); setOpen(false); }}
                title={k}
                type="button"
                dangerouslySetInnerHTML={{ __html: window.PREMIUM_ICON_PATHS ? `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${window.PREMIUM_ICON_PATHS[k]}</svg>` : "" }}
              />
            ))}
          </div>
          <div className="page-icon-emoji-row">
            <input
              className="page-icon-emoji-input"
              placeholder="Or paste an emoji…"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && emoji.trim()) { onChange(emoji.trim()); setEmoji(""); setOpen(false); } }}
            />
            <button className="page-icon-emoji-apply" type="button" onClick={() => { if (emoji.trim()) { onChange(emoji.trim()); setEmoji(""); setOpen(false); } }}>Set</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== BUILT-IN TEMPLATES ======
// Templates that ship with the app (shown in the Templates picker, non-deletable).
// Pulls multi-block templates (like Content Shooting) straight from the slash-command list
// so there's a single source of truth.
function getBuiltinTemplates() {
  const cmds = window.SLASH_COMMANDS || [];
  const builtins = [];
  const shoot = cmds.find((c) => c.label === "Content Shooting" && typeof c.makeMany === "function");
  if (shoot) {
    builtins.push({
      id: "builtin_content_shooting",
      name: "Content Shooting",
      icon: "🎬",
      builtin: true,
      makeBlocks: () => shoot.makeMany(),
    });
  }
  return builtins;
}

// ====== PAGE EDITOR ======
function PageEditor({ page, updatePage, updateBlock, patchBlock, deleteBlock, addBlock, addBlockAfter, addBlockBefore, replaceBlock, moveBlock, data, setCurrentPage, updateEvents, addPage, presenceLocks = {}, onWordBoundary, authUser, activeWorkspaceId }) {
  // Make forceHistoryCommit available globally so EditableText can call it on word boundaries
  useEffect(() => { window.__onWordBoundary = onWordBoundary; }, [onWordBoundary]);

  const downloadPageAsPdf = () => {
    if (!page) return;
    const ZW = /​/g;
    // Rich inline text → run through the SAME allowlist sanitizer the editor uses, so
    // bold/italic/underline survive in the PDF but any injected <script>/<img onerror>/
    // event-handler attributes (e.g. content written straight to the API, bypassing the
    // editor) are stripped before we drop it into the exported document.
    const richText = (h) => (window.sanitizeHtml ? window.sanitizeHtml(String(h || "")) : String(h || "").replace(/<[^>]*>/g, "")).replace(ZW, "");
    const stripHtml = (h) => (window.stripHtml ? window.stripHtml(h || "") : String(h || "").replace(/<[^>]*>/g, "")).replace(ZW, "");
    // Escape for HTML text/attribute context (icons, dates, plain labels).
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    // Only allow safe image URL schemes — blocks `javascript:` and quote-breakout payloads.
    const safeUrl = (u) => { const s = String(u || "").trim(); return /^(https?:|data:image\/)/i.test(s) ? s.replace(/"/g, "%22") : ""; };
    const listLevel = (item) => Math.max(0, Math.min(2, Number(item?.level ?? (item?.indent ? 1 : 0)) || 0));
    const textIndentLevel = (block) => Math.max(0, Math.min(2, Number(block?.textIndentLevel) || 0));
    const bulletStyle = ["disc", "circle", "square"];
    const numberStyle = ["decimal", "lower-alpha", "lower-roman"];
    const renderListItems = (items, styles) => (items || []).map((item) => {
      const level = listLevel(item);
      return `<li style="margin-left:${level * 24}px;list-style-type:${styles[level]}">${richText(item.text)}</li>`;
    }).join("");
    const blocks = page.blocks || [];
    let bodyHtml = "";
    for (const block of blocks) {
      switch (block.type) {
        case "heading": { const lvl = Math.min(3, Math.max(1, Number(block.level) || 1)); bodyHtml += `<h${lvl} style="margin:1em 0 0.3em">${richText(block.text)}</h${lvl}>\n`; break; }
        case "text": bodyHtml += `<p style="margin:0.4em 0 0.4em ${textIndentLevel(block) * 24}px">${richText(block.text) || "&nbsp;"}</p>\n`; break;
        case "bullets": bodyHtml += `<ul>${renderListItems(block.items, bulletStyle)}</ul>\n`; break;
        case "numbers": bodyHtml += `<ol>${renderListItems(block.items, numberStyle)}</ol>\n`; break;
        case "checklist": bodyHtml += `<ul style="list-style:none;padding:0">${(block.items||[]).map(i=>`<li>${i.done?"☑":"☐"} ${stripHtml(i.text||"")}</li>`).join("")}</ul>\n`; break;
        case "callout": bodyHtml += `<blockquote style="background:#f8f8f0;border-left:4px solid #e0c97f;padding:10px 16px;margin:12px 0;border-radius:4px">${esc(block.icon||"💡")} ${richText(block.text)}</blockquote>\n`; break;
        case "divider": bodyHtml += `<hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>\n`; break;
        case "image": { const u = safeUrl(block.src); bodyHtml += u ? `<img src="${u}" style="max-width:100%;border-radius:6px;margin:8px 0"/>\n` : ""; break; }
        case "table": {
          const rows = block.rows || [];
          bodyHtml += `<table style="border-collapse:collapse;width:100%;margin:12px 0">`;
          rows.forEach((row, ri) => {
            bodyHtml += "<tr>";
            (row||[]).forEach(cell => {
              const tag = ri === 0 ? "th" : "td";
              bodyHtml += `<${tag} style="border:1px solid #ddd;padding:6px 10px;${ri===0?"background:#f5f5f5;font-weight:600":"background:#fff"}">${richText(cell)}</${tag}>`;
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(pageTitle)}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.6}
      h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.2em}
      p,li{font-size:1em}
      ul,ol{padding-left:24px}
      @media print{body{margin:0;padding:16px}}
    </style></head><body>
    <h1 style="font-size:2.2em;margin-bottom:0.2em">${page.icon && !(window.isPremiumIconKey && window.isPremiumIconKey(page.icon)) ? esc(page.icon)+" " : ""}${esc(pageTitle)}</h1>
    ${page.date ? `<p style="color:#888;margin-top:0;font-size:0.9em">${esc(page.date)}</p>` : ""}
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
  const [focusAtStart, setFocusAtStart] = useState(false);
  const [dragBlockId, setDragBlockId] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState(new Set());
  const [marquee, setMarquee] = useState(null);
  const [formatBar, setFormatBar] = useState(null); // { rect, blockId }
  const [blockMenu, setBlockMenu] = useState(null); // { blockId, x, y } — block action menu
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch { return []; }
  });
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerAnchorId, setTemplatePickerAnchorId] = useState(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState("");
  const pageBodyRef = useRef(null);
  const marqueeRef = useRef(null);
  const textSelectionDragRef = useRef(null);
  const cellSelRef = useRef(null);              // { matrix: cellEl[][] } for table cell-range copy
  const multiSelectedIdsRef = useRef(multiSelectedIds); // mirror for the copy handler
  const blocks = page?.blocks || [];
  const focusBlock = (id, atStart = false) => {
    setFocusBlockId(id);
    setFocusAtStart(atStart);
    setFocusNonce((value) => value + 1);
  };

  // Move cursor to previous/next block, or merge blocks on Backspace at start
  const moveToPreviousBlock = (currentBlockId, mode = "end") => {
    if (!page) return;
    const idx = page.blocks.findIndex(b => b.id === currentBlockId);
    if (idx <= 0) return;
    if (mode === "merge-current") {
      const current = page.blocks[idx];
      const prev = page.blocks[idx - 1];
      if (!prev || !current) return;
      const MERGEABLE = ["text", "heading"];
      if (MERGEABLE.includes(prev.type) && current.type === "text") {
        const prevPlain = (window.stripHtml ? window.stripHtml(prev.text || "") : (prev.text || "").replace(/<[^>]*>/g, "")).replace(/​/g, "");
        if (!prevPlain.trim()) {
          // Previous block is blank — just delete it, cursor stays at start of current block.
          // This removes the empty line without teleporting the caret.
          const newBlocks = page.blocks.filter((_, i) => i !== idx - 1);
          updatePage(page.id, { blocks: newBlocks });
          focusBlock(current.id, true);
        } else {
          // Previous block has content — merge and place cursor exactly at the junction
          // (after prev text, before current text) so it feels like text flowed together.
          // Use a DOM text-walk to measure the offset (same method setCaretOffset uses),
          // so the caret lands correctly even when prev.text has inline <b>/<i>/etc.
          const tmpDiv = document.createElement('div');
          tmpDiv.innerHTML = window.sanitizeHtml ? window.sanitizeHtml(prev.text || '') : (prev.text || '');
          let junctionOffset = 0;
          const tw = document.createTreeWalker(tmpDiv, NodeFilter.SHOW_TEXT);
          while (tw.nextNode()) junctionOffset += tw.currentNode.nodeValue.length;
          // Sanitize the concatenated HTML to avoid fused inline tags or stray <br>​
          const rawMerged = (prev.text || "") + (current.text || "");
          const mergedText = window.sanitizeHtml ? window.sanitizeHtml(rawMerged) : rawMerged;
          const merged = { ...prev, text: mergedText };
          const newBlocks = page.blocks.filter((_, i) => i !== idx);
          newBlocks[idx - 1] = merged;
          updatePage(page.id, { blocks: newBlocks });
          window._pendingCaretOffset = junctionOffset;
          focusBlock(prev.id, false);
        }
      } else {
        // Can't merge (complex block types) — just move cursor to end of prev block
        focusBlock(page.blocks[idx - 1].id, false);
      }
    } else {
      focusBlock(page.blocks[idx - 1].id, mode === "start");
    }
  };
  const moveToNextBlock = (currentBlockId, mode = "start") => {
    if (!page) return;
    const idx = page.blocks.findIndex(b => b.id === currentBlockId);
    if (idx >= page.blocks.length - 1) return;
    focusBlock(page.blocks[idx + 1].id, mode === "start");
  };

  // Forward-Delete at the end of a block: merge the NEXT block into the current
  // one (inverse of the Backspace-at-start merge). Because we merge INTO the
  // focused block, the caret keeps its offset automatically — EditableText's
  // value-sync restores it, so the cursor stays at the junction.
  const mergeNextBlockIn = (currentBlockId) => {
    if (!page || page.system) return;
    const idx = page.blocks.findIndex(b => b.id === currentBlockId);
    if (idx === -1 || idx >= page.blocks.length - 1) return;
    const cur = page.blocks[idx];
    const next = page.blocks[idx + 1];
    const LISTY = ["bullets", "numbers", "checklist"];
    const san = (h) => window.sanitizeHtml ? window.sanitizeHtml(h) : h;
    const plain = (h) => (window.stripHtml ? window.stripHtml(h || "") : String(h || "").replace(/<[^>]*>/g, "")).trim();
    let newBlocks = null;
    if ((cur.type === "text" || cur.type === "heading") && (next.type === "text" || next.type === "heading")) {
      newBlocks = page.blocks.filter((_, i) => i !== idx + 1);
      newBlocks[idx] = { ...cur, text: san((cur.text || "") + (next.text || "")) };
    } else if ((cur.type === "text" || cur.type === "heading") && LISTY.includes(next.type) && (next.items || []).length) {
      // Pull the FIRST list item's text into the current block; the rest stay a list.
      const first = next.items[0];
      const rest = next.items.slice(1);
      newBlocks = [...page.blocks];
      newBlocks[idx] = { ...cur, text: san((cur.text || "") + (first.text || "")) };
      if (rest.length) newBlocks[idx + 1] = { ...next, items: rest };
      else newBlocks.splice(idx + 1, 1);
    } else if (LISTY.includes(cur.type) && next.type === "text" && (cur.items || []).length) {
      // Append the next text block's content to the LAST list item.
      newBlocks = page.blocks.filter((_, i) => i !== idx + 1);
      if (plain(next.text)) {
        const items = [...cur.items];
        const last = items[items.length - 1];
        items[items.length - 1] = { ...last, text: san((last.text || "") + (next.text || "")) };
        newBlocks[idx] = { ...cur, items };
      }
    } else {
      // Complex neighbour (table, KPI, divider…) — just hop the caret over it.
      focusBlock(next.id, true);
      return;
    }
    updatePage(page.id, { blocks: newBlocks });
  };

  // Stable ref so the selectionchange listener always sees the latest blocks
  // without needing to re-subscribe on every keystroke.
  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; });
  useEffect(() => { multiSelectedIdsRef.current = multiSelectedIds; }, [multiSelectedIds]);
  // Mirrors for the copy/cut listeners (registered once, so they read refs, not closures).
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; });
  const updatePageRef = useRef(updatePage);
  useEffect(() => { updatePageRef.current = updatePage; });

  // Show inline format-bar when the user selects text within a single block.
  // Guarded against the selectionchange re-render storm: selectionchange fires on
  // every mousemove during a drag-select, so we only call setState when the bar's
  // logical position actually changes. Constant re-renders here were resetting
  // contentEditable nodes mid-drag and yanking the page scroll to the bottom.
  const lastFormatBarKeyRef = useRef("");
  useEffect(() => {
    const computeFormatBar = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      const pb = pageBodyRef.current;
      if (!pb || !pb.contains(range.commonAncestorContainer)) return null;
      const nodeEl = (node) => node && (node.nodeType === 1 ? node : node.parentElement);
      const startEditable = nodeEl(range.startContainer)?.closest?.(".editable");
      const endEditable = nodeEl(range.endContainer)?.closest?.(".editable");
      if (!startEditable || startEditable !== endEditable) return null;
      const blockEl = startEditable.closest("[data-block-id]");
      if (!blockEl) return null;
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return { blockId: blockEl.dataset.blockId, rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width } };
    };
    const updateFormatBarPosition = () => {
      const next = computeFormatBar();
      // Round to whole pixels so sub-pixel jitter doesn't trigger renders.
      const key = next ? `${next.blockId}:${Math.round(next.rect.top)}:${Math.round(next.rect.left)}:${Math.round(next.rect.width)}` : "";
      if (key === lastFormatBarKeyRef.current) return; // nothing meaningful changed
      lastFormatBarKeyRef.current = key;
      setFormatBar(next);
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

  // NOTE: We intentionally DO NOT highlight whole blocks during normal text
  // selection. Plain text selection uses the browser's native ::selection
  // highlight (just the selected characters), like Google Docs. The full-block
  // blue highlight (.multi-selected) is reserved for explicit BLOCK selection:
  // dragging in the margin (marquee) or clicking a block's side handle.
  const lastMultiKeyRef = useRef(""); // still used by marquee + handle-click guards

  // Block action menu — opened by clicking a block's drag handle. Clicking the
  // handle also visually selects that single block (highlight), Lark/Notion style.
  useEffect(() => {
    const onHandleClick = (e) => {
      const { blockId, x, y } = e.detail || {};
      if (!blockId) return;
      window.getSelection()?.removeAllRanges();
      lastMultiKeyRef.current = blockId;
      setMultiSelectedIds(new Set([blockId]));
      setFormatBar(null);
      setBlockMenu({ blockId, x, y });
    };
    window.addEventListener("block-handle-click", onHandleClick);
    return () => window.removeEventListener("block-handle-click", onHandleClick);
  }, []);

  // Touch-drag reorder: the block handle's Pointer-Events fallback dispatches this
  // when a finger-drag is released over a target block. The event carries the
  // dragged id explicitly (we can't rely on the dragBlockId state having flushed),
  // so move directly. Routed through a ref so the once-registered listener always
  // sees the latest moveBlock prop.
  const moveBlockRef = useRef(null);
  moveBlockRef.current = moveBlock;
  useEffect(() => {
    const onTouchDrop = (e) => {
      const { draggedId, targetId, side } = e.detail || {};
      if (draggedId && targetId && draggedId !== targetId) {
        moveBlockRef.current?.(draggedId, targetId, side || "before");
      }
    };
    window.addEventListener("block-touch-drop", onTouchDrop);
    return () => window.removeEventListener("block-touch-drop", onTouchDrop);
  }, []);

  const closeBlockMenu = () => {
    setBlockMenu(null);
    lastMultiKeyRef.current = "";
    setMultiSelectedIds(new Set());
    clearCellHighlight();
  };

  // Intercept copy/cut/range-delete so the clipboard + deletions preserve block
  // structure (headings stay headings, nested list items keep their nesting, etc.).
  //
  // ⚠️ REGRESSION GUARD — DO NOT change the dependency array below to []. ⚠️
  // `.page-container` is keyed by `page.id` (see render: `key={page.id}`), so its
  // child `.page-body` is a BRAND-NEW DOM node every time you open a different page.
  // These three listeners (copy/cut/keydown) are the only ones in this file bound
  // directly to the captured `pageBody` node. With [] deps the effect runs once and
  // stays bound to the FIRST page's body — after you navigate to any other page the
  // listeners are orphaned on a detached node and copy/cut/multi-row-delete silently
  // fall back to broken native behaviour. The [page?.id] dep re-runs this effect on
  // every page switch so it always binds to the live body. This has regressed
  // repeatedly; keep the dep.
  useEffect(() => {
    const pageBody = pageBodyRef.current;
    if (!pageBody) return;
    // Remove all non-content UI chrome from a cloned fragment so copies never
    // carry bullet dots (•), delete buttons (×), checkboxes, handles, etc.
    const JUNK_SEL = ".bullet-dot,.number-dot,.check-box,.block-handle,.block-delete-btn,.tbl-del,.row-del,.tbl-cell-clear,.tbl-add,.tbl-add-row,.block-lock-badge,.tbl-resize-handle,.ct-col-del,.ct-col-status,.ct-col-check,button,[contenteditable=\"false\"]";
    const cleanClone = (range) => {
      const tmp = document.createElement("div");
      tmp.appendChild(range.cloneContents());
      tmp.querySelectorAll(JUNK_SEL).forEach((n) => n.remove());
      const html = window.sanitizeHtml ? window.sanitizeHtml(tmp.innerHTML) : tmp.innerHTML;
      const text = (tmp.textContent || "").replace(/​/g, "").replace(/ /g, " ");
      return { html, text };
    };
    const cellText = (cell) => {
      const ed = cell.querySelector(".editable") || cell;
      return (window.stripHtml ? window.stripHtml(ed.innerHTML || "") : (ed.textContent || "")).replace(/​/g, "").trim();
    };
    const cellHtml = (cell) => {
      const ed = cell.querySelector(".editable") || cell;
      const html = (ed.innerHTML || "").replace(/​/g, "");
      return window.sanitizeHtml ? window.sanitizeHtml(html) : html;
    };
    const buildSelectedCellsPayload = (cellMatrix) => {
      const textMatrix = cellMatrix.map((row) => row.map(cellText));
      const htmlMatrix = cellMatrix.map((row) => row.map(cellHtml));
      const tsv = textMatrix.map((r) => r.join("\t")).join("\n");
      const htmlTbl = `<table data-wault-cell-selection="1">${htmlMatrix.map((r) => `<tr>${r.map((c) => `<td>${c || ""}</td>`).join("")}</tr>`).join("")}</table>`;
      const html = `<!--StartFragment-->${htmlTbl}<!--EndFragment-->`;
      const blockPayload = JSON.stringify([{
        id: window.nid(),
        type: "table",
        cellSelection: true,
        headers: htmlMatrix[0] || [],
        rows: htmlMatrix.slice(1).map((cells) => ({ id: window.nid(), cells })),
      }]);
      return { textMatrix, htmlMatrix, tsv, html, blockPayload };
    };
    const writeSelectedCellsPayload = (e, cellMatrix) => {
      const payload = buildSelectedCellsPayload(cellMatrix);
      e.clipboardData.setData("text/html", payload.html);
      e.clipboardData.setData("text/plain", payload.tsv);
      try { e.clipboardData.setData("application/x-wault-cells", JSON.stringify(payload.htmlMatrix)); } catch (_) {}
      try { e.clipboardData.setData("application/x-wault-blocks", payload.blockPayload); } catch (_) {}
      e.preventDefault();
    };
    const writeSelectedCellsSystemClipboard = async (cellMatrix) => {
      const payload = buildSelectedCellsPayload(cellMatrix);
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new window.ClipboardItem({
            "text/html": new Blob([payload.html], { type: "text/html" }),
            "text/plain": new Blob([payload.tsv], { type: "text/plain" }),
          })]);
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(payload.tsv);
        }
      } catch (_) {}
    };

    // ── Selection-accurate helpers ────────────────────────────────────────
    const LIST_TYPES = ["bullets", "numbers", "checklist", "milestones"];
    const itemTextField = (blockType) => blockType === "milestones" ? "name" : "text";

    // True when `range` fully covers the content of `el`.
    const rangeCoversEl = (range, el) => {
      try {
        const r = document.createRange();
        r.selectNodeContents(el);
        return range.compareBoundaryPoints(Range.START_TO_START, r) <= 0 &&
               range.compareBoundaryPoints(Range.END_TO_END, r) >= 0;
      } catch { return false; }
    };

    // Intersection of `range` with the contents of one editable, as sanitized HTML.
    const sliceRangeHtml = (ed, range) => {
      const r = document.createRange();
      r.selectNodeContents(ed);
      try {
        if (ed.contains(range.startContainer)) r.setStart(range.startContainer, range.startOffset);
        if (ed.contains(range.endContainer)) r.setEnd(range.endContainer, range.endOffset);
      } catch (_) {}
      const tmp = document.createElement("div");
      tmp.appendChild(r.cloneContents());
      tmp.querySelectorAll(JUNK_SEL).forEach((n) => n.remove());
      return (window.sanitizeHtml ? window.sanitizeHtml(tmp.innerHTML) : tmp.innerHTML)
        .replace(/<br\s*\/?>\s*$/i, "");
    };

    // What's left of one editable's content once the selected part is removed (for cut).
    const remainderHtml = (ed, range) => {
      const parts = [];
      try {
        if (ed.contains(range.startContainer)) {
          const r = document.createRange();
          r.selectNodeContents(ed);
          r.setEnd(range.startContainer, range.startOffset);
          const tmp = document.createElement("div");
          tmp.appendChild(r.cloneContents());
          parts.push(tmp.innerHTML);
        }
        if (ed.contains(range.endContainer)) {
          const r = document.createRange();
          r.selectNodeContents(ed);
          r.setStart(range.endContainer, range.endOffset);
          const tmp = document.createElement("div");
          tmp.appendChild(r.cloneContents());
          parts.push(tmp.innerHTML);
        }
      } catch (_) {}
      const html = parts.join("");
      return window.sanitizeHtml ? window.sanitizeHtml(html) : html;
    };

    const plainOf = (h) => (window.stripHtml ? window.stripHtml(h || "") : String(h || "").replace(/<[^>]*>/g, "")).trim();

    // Build a block that contains ONLY what the range selected of it.
    // Returns null when nothing meaningful of the block is inside the range.
    const partialBlockFromRange = (block, el, range) => {
      if (rangeCoversEl(range, el)) return block;
      if (LIST_TYPES.includes(block.type) && Array.isArray(block.items)) {
        const field = itemTextField(block.type);
        const rows = [...el.querySelectorAll("[data-item-id]")];
        const rowById = new Map(rows.map((r) => [r.getAttribute("data-item-id"), r]));
        const picked = [];
        block.items.forEach((item) => {
          const row = rowById.get(String(item.id));
          if (!row) return;
          let hit = false;
          try { hit = range.intersectsNode(row); } catch (_) {}
          if (!hit) return;
          const ed = row.querySelector(".editable");
          const isBoundary = ed && (ed.contains(range.startContainer) || ed.contains(range.endContainer));
          if (!isBoundary) { picked.push({ ...item }); return; }
          const sliced = sliceRangeHtml(ed, range);
          // A boundary item with an empty slice was only "touched" at its edge — skip it.
          if (!plainOf(sliced)) return;
          picked.push({ ...item, [field]: sliced });
        });
        if (!picked.length) return null;
        return { ...block, items: picked };
      }
      if (["text", "heading", "callout"].includes(block.type)) {
        const eds = [...el.querySelectorAll(".editable")];
        const ed = eds.find((x) => x.contains(range.startContainer) || x.contains(range.endContainer)) || eds[eds.length - 1];
        if (!ed) return block;
        const sliced = sliceRangeHtml(ed, range);
        if (!plainOf(sliced)) return null;
        return { ...block, text: sliced };
      }
      // Tables / KPIs / progress / dividers: all-or-nothing.
      return block;
    };

    // Write a blocks payload to the clipboard: semantic HTML + plain text + the
    // exact JSON under a custom type so internal pastes are 100% faithful even
    // across tabs (where the in-memory clipboard can't help).
    const writeBlocksPayload = (e, blocksArr) => {
      const { html, text } = window.serializeBlocksForClipboard(blocksArr);
      e.clipboardData.setData("text/html", `<!--StartFragment-->${html}<!--EndFragment-->`);
      e.clipboardData.setData("text/plain", text);
      try { e.clipboardData.setData("application/x-wault-blocks", JSON.stringify(blocksArr)); } catch (_) {}
    };

    const touchedBlocksOf = (range) => blocksRef.current.filter((b) => {
      const el = pageBody.querySelector(`[data-block-id="${b.id}"]`);
      if (!el) return false;
      try { return range.intersectsNode(el); } catch { return false; }
    });

    const onCopy = (e) => {
      // Reset the in-memory clipboard; only full-block serialization repopulates it,
      // so a partial/inline/cell copy can never falsely match on the next paste.
      window._waultClipboard = null;
      // (A) Table cell-range selection captured during a cross-cell drag.
      const cellSel = cellSelRef.current;
      if (cellSel?.matrix?.length) {
        writeSelectedCellsPayload(e, cellSel.matrix);
        return;
      }

      const sel = window.getSelection();
      // (B) Block-level selection (cross-block drag, handle click, marquee) with no
      //     native text range → serialise the whole selected blocks cleanly.
      const selIds = multiSelectedIdsRef.current;
      if (selIds && selIds.size && (!sel || sel.isCollapsed || sel.rangeCount === 0)) {
        const chosen = blocksRef.current.filter((b) => selIds.has(b.id));
        if (chosen.length) {
          writeBlocksPayload(e, chosen);
          e.preventDefault();
          return;
        }
      }

      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!pageBody.contains(range.commonAncestorContainer)) return;

      // Is the whole selection inside a single editable field? → clean inline copy.
      const startEd = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest?.(".editable");
      const endEd = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement)?.closest?.(".editable");

      const touched = touchedBlocksOf(range);
      if (!touched.length) return;

      // ── Table cell-range copy (TSV + <table>) — works across multiple cells ──
      // Do NOT rely on range.commonAncestorContainer being inside the table: when
      // users drag-highlight cells, browsers often report `.page-body` as the
      // common ancestor. Use the touched table block as the authority instead.
      const tableBlock = touched.length === 1 && (touched[0].type === "table" || touched[0].type === "content-shooting-table") ? touched[0] : null;
      const tableBlockRoot = tableBlock ? pageBody.querySelector(`[data-block-id="${tableBlock.id}"]`) : null;
      const tableBlockEl = tableBlockRoot?.querySelector?.(".tbl-wrap table");
      if (tableBlockEl) {
        const rows = [...tableBlockEl.querySelectorAll("tr")];
        const matrix = [];
        rows.forEach((tr) => {
          const cells = [...tr.querySelectorAll("th,td")].filter((c) => c.querySelector(".editable"));
          const picked = cells.filter((c) => { try { return range.intersectsNode(c); } catch { return false; } });
          if (picked.length) matrix.push(picked);
        });
        const cellCount = matrix.reduce((n, r) => n + r.length, 0);
        // A selection inside a SINGLE cell falls through to the inline path below,
        // so partial text in one cell copies as exactly that text — not the whole cell.
        if (matrix.length && cellCount > 1) {
          writeSelectedCellsPayload(e, matrix);
          return;
        }
      }

      if (startEd && startEd === endEd) {
        // Selection lives inside ONE editable (one list item, one paragraph, one cell).
        // Copy EXACTLY the highlighted text — never the surrounding block. This is the
        // "what you highlight is what you paste" rule.
        const block = touched[0];
        const { html: inner, text: innerText } = cleanClone(range);
        let html, text;
        switch (block?.type) {
          case "heading": html = `<h${block.level}>${inner}</h${block.level}>`; text = innerText; break;
          case "callout": html = `<blockquote>${inner}</blockquote>`; text = innerText; break;
          default:        html = `<p>${inner}</p>`; text = innerText; break;
        }
        e.clipboardData.setData("text/html", `<!--StartFragment-->${html}<!--EndFragment-->`);
        e.clipboardData.setData("text/plain", text);
        e.preventDefault();
        return;
      }

      // Spans multiple editables/blocks → slice each touched block down to exactly
      // the selected items/text (boundary blocks partial, middle blocks whole).
      const partial = touched
        .map((b) => {
          const el = pageBody.querySelector(`[data-block-id="${b.id}"]`);
          return el ? partialBlockFromRange(b, el, range) : null;
        })
        .filter(Boolean);
      if (!partial.length) return;
      writeBlocksPayload(e, partial);
      e.preventDefault();
    };

    // ── Cut: same payload as copy, then remove the selection from the model ──
    const removeBlocksByIds = (ids) => {
      const pg = pageRef.current;
      if (!pg || pg.system) return;
      const idSet = new Set(ids);
      const next = (pg.blocks || []).filter((b) => !idSet.has(b.id));
      updatePageRef.current?.(pg.id, { blocks: next.length ? next : [{ id: window.nid(), type: "text", text: "" }] });
      setMultiSelectedIds(new Set());
    };

    const applyRangeDeletion = (range, touched) => {
      const pg = pageRef.current;
      if (!pg || pg.system) return;
      const touchedIds = new Set(touched.map((b) => b.id));
      const nextBlocks = [];
      (pg.blocks || []).forEach((b) => {
        if (!touchedIds.has(b.id)) { nextBlocks.push(b); return; }
        const el = pageBody.querySelector(`[data-block-id="${b.id}"]`);
        if (!el) { nextBlocks.push(b); return; }
        if (rangeCoversEl(range, el)) return; // fully selected → remove the block
        if (LIST_TYPES.includes(b.type) && Array.isArray(b.items)) {
          const field = itemTextField(b.type);
          const rows = [...el.querySelectorAll("[data-item-id]")];
          const rowById = new Map(rows.map((r) => [r.getAttribute("data-item-id"), r]));
          const keep = [];
          b.items.forEach((item) => {
            const row = rowById.get(String(item.id));
            if (!row) { keep.push(item); return; }
            let hit = false;
            try { hit = range.intersectsNode(row); } catch (_) {}
            if (!hit) { keep.push(item); return; }
            const ed = row.querySelector(".editable");
            const isBoundary = ed && (ed.contains(range.startContainer) || ed.contains(range.endContainer));
            if (!isBoundary) return; // fully inside the selection → drop
            const rest = remainderHtml(ed, range);
            if (plainOf(rest)) keep.push({ ...item, [field]: rest });
          });
          if (keep.length) nextBlocks.push({ ...b, items: keep });
          return;
        }
        if (["text", "heading", "callout"].includes(b.type)) {
          const eds = [...el.querySelectorAll(".editable")];
          const ed = eds.find((x) => x.contains(range.startContainer) || x.contains(range.endContainer)) || eds[eds.length - 1];
          if (!ed) { nextBlocks.push(b); return; }
          nextBlocks.push({ ...b, text: remainderHtml(ed, range) });
          return;
        }
        nextBlocks.push(b); // tables/KPIs/etc. are never deleted by a text-range cut
      });
      updatePageRef.current?.(pg.id, {
        blocks: nextBlocks.length ? nextBlocks : [{ id: window.nid(), type: "text", text: "" }],
      });
    };

    const onCut = (e) => {
      const pg = pageRef.current;
      if (!pg || pg.system) return;
      window._waultClipboard = null;
      const sel = window.getSelection();
      const selIds = multiSelectedIdsRef.current;
      // Block-level selection → copy whole blocks, then remove them.
      if (selIds && selIds.size && (!sel || sel.isCollapsed || sel.rangeCount === 0)) {
        const chosen = blocksRef.current.filter((b) => selIds.has(b.id));
        if (!chosen.length) return;
        writeBlocksPayload(e, chosen);
        e.preventDefault();
        removeBlocksByIds([...selIds]);
        return;
      }
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!pageBody.contains(range.commonAncestorContainer)) return;
      const startEd = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest?.(".editable");
      const endEd = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement)?.closest?.(".editable");
      // Inside a single editable the browser's native cut is correct (copy + delete
      // + input event) — don't interfere.
      if (startEd && startEd === endEd) return;
      const touched = touchedBlocksOf(range);
      if (!touched.length) return;
      const partial = touched
        .map((b) => {
          const el = pageBody.querySelector(`[data-block-id="${b.id}"]`);
          return el ? partialBlockFromRange(b, el, range) : null;
        })
        .filter(Boolean);
      if (!partial.length) return;
      writeBlocksPayload(e, partial);
      e.preventDefault();
      applyRangeDeletion(range, touched);
      try { sel.removeAllRanges(); } catch (_) {}
    };

    // ── Backspace / Delete across MULTIPLE editables (list rows or blocks) ──
    // Each list item is its own contenteditable, so a native Backspace only ever
    // deletes the focused row even when several rows are highlighted. When the
    // selection spans more than one editable we reuse the exact cut-path deletion
    // so "what you highlight is what gets deleted". Capture phase + stopPropagation
    // so the per-row EditableText handlers never run the single-row native delete.
    // Single-editable selections fall through untouched to native handling.
    const onRangeDeleteKey = (e) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const pg = pageRef.current;
      if (!pg || pg.system) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!pageBody.contains(range.commonAncestorContainer)) return;
      const edOf = (node) => (node && (node.nodeType === 1 ? node : node.parentElement))?.closest?.(".editable");
      const startEd = edOf(range.startContainer);
      const endEd = edOf(range.endContainer);
      if (startEd && startEd === endEd) return; // one editable → native delete is correct
      const touched = touchedBlocksOf(range);
      if (!touched.length) return;
      e.preventDefault();
      e.stopPropagation();
      applyRangeDeletion(range, touched);
      try { sel.removeAllRanges(); } catch (_) {}
    };

    // A blue table-cell rectangle is WAULT-managed state, not always a native
    // browser text selection. In that focus state, some browsers dispatch ⌘C to
    // document/body instead of `.page-body` (or skip the copy event entirely).
    // This fallback makes the visible cell selection the authority: if cells are
    // selected, ⌘C always writes just those cells to the system clipboard.
    const onCellSelectionCopyKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || String(e.key || "").toLowerCase() !== "c") return;
      const cellSel = cellSelRef.current;
      if (!cellSel?.matrix?.length) return;
      window._waultClipboard = null;
      e.preventDefault();
      e.stopPropagation();
      writeSelectedCellsSystemClipboard(cellSel.matrix);
    };

    const onDocumentCellCopy = (e) => {
      if (e.defaultPrevented) return;
      const cellSel = cellSelRef.current;
      if (!cellSel?.matrix?.length) return;
      window._waultClipboard = null;
      writeSelectedCellsPayload(e, cellSel.matrix);
      e.stopPropagation();
    };

    pageBody.addEventListener("keydown", onRangeDeleteKey, true);
    pageBody.addEventListener("copy", onCopy);
    pageBody.addEventListener("cut", onCut);
    document.addEventListener("keydown", onCellSelectionCopyKey, true);
    document.addEventListener("copy", onDocumentCellCopy, true);
    return () => {
      pageBody.removeEventListener("keydown", onRangeDeleteKey, true);
      pageBody.removeEventListener("copy", onCopy);
      pageBody.removeEventListener("cut", onCut);
      document.removeEventListener("keydown", onCellSelectionCopyKey, true);
      document.removeEventListener("copy", onDocumentCellCopy, true);
    };
    // page?.id: rebind to the fresh page-body node after every page switch
    // (page-container is keyed). See the regression-guard comment above. Keep this dep.
  }, [page?.id]);

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
    const index = blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;
    if (blocks.length === 1) {
      updatePage(page.id, { blocks: [{ id: blockId, type: "text", text: "" }] });
      focusBlock(blockId);
      return;
    }
    const focusTarget = blocks[Math.max(0, index - 1)];
    updatePage(page.id, (pg) => {
      const next = (pg.blocks || []).filter((b) => b.id !== blockId);
      return { blocks: next.length ? next : [createTextBlock()] };
    });
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
    } else if (targetType === "checklist") {
      const plainText = window.stripHtml ? window.stripHtml(text) : text;
      newBlock = { id: blockId, type:"checklist", items: [{ id: window.nid(), text: plainText ? window.sanitizeHtml(plainText) : "", done:false, dueDate:"" }] };
    } else if (targetType === "callout") {
      newBlock = { id: blockId, type:"callout", icon:"💡", text };
    } else {
      return;
    }
    updatePage(page.id, { blocks: blocks.map((b) => b.id === blockId ? newBlock : b) });
    setFormatBar(null);
    window.getSelection()?.removeAllRanges();
    focusBlock(blockId);
  };

  // Duplicate a block (new id + new item ids) directly after the original.
  const duplicateBlock = (blockId) => {
    if (!page || page.system) return;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const src = blocks[idx];
    const clone = JSON.parse(JSON.stringify(src));
    clone.id = window.nid();
    if (Array.isArray(clone.items)) clone.items = clone.items.map((it) => ({ ...it, id: window.nid() }));
    if (Array.isArray(clone.rows)) clone.rows = clone.rows.map((r) => ({ ...r, id: window.nid() }));
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    updatePage(page.id, { blocks: next });
  };

  // Copy one block to the clipboard (rich + plain) without needing a text selection.
  const copyBlockToClipboard = (blockId) => {
    const b = blocks.find((x) => x.id === blockId);
    if (!b) return;
    const html = window.serializeBlockToHtml ? window.serializeBlockToHtml(b) : "";
    const text = window.serializeBlockToText ? window.serializeBlockToText(b) : "";
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new window.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]).catch(() => navigator.clipboard?.writeText?.(text));
    } else {
      navigator.clipboard?.writeText?.(text);
    }
  };

  const replaceBlockWithBlocks = (blockId, replacementBlocks, focusId) => {
    if (!page || page.system || !Array.isArray(replacementBlocks)) return;
    updatePage(page.id, {
      blocks: blocks.flatMap((block) => block.id === blockId ? replacementBlocks : [block]),
    });
    if (focusId) focusBlock(focusId);
  };

  // ── User-defined templates (localStorage) ────────────────────────────────
  const cloneBlocksWithNewIds = (src) =>
    (src || []).map((b) => {
      const copy = JSON.parse(JSON.stringify(b));
      copy.id = window.nid();
      if (Array.isArray(copy.items)) copy.items = copy.items.map((i) => ({ ...i, id: window.nid() }));
      if (Array.isArray(copy.rows)) copy.rows = copy.rows.map((r) => ({ ...r, id: window.nid() }));
      return copy;
    });

  const openTemplatePicker = (anchorId = null) => {
    try { setTemplates(JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]")); } catch {}
    setTemplatePickerAnchorId(anchorId);
    setTemplatePickerOpen(true);
  };

  const doApplyTemplate = (tpl) => {
    if (!tpl || !page || page.system) return;
    // Built-in templates generate fresh blocks on demand; user templates store blocks.
    const fresh = tpl.builtin && typeof tpl.makeBlocks === "function"
      ? tpl.makeBlocks()
      : cloneBlocksWithNewIds(tpl.blocks);
    if (!fresh.length) { setTemplatePickerOpen(false); return; }
    if (templatePickerAnchorId) {
      replaceBlockWithBlocks(templatePickerAnchorId, fresh, fresh[0].id);
    } else {
      const next = ensureTrailingTextBlock([...blocks, ...fresh]);
      updatePage(page.id, { blocks: next });
      focusBlock(fresh[0].id);
    }
    setTemplatePickerOpen(false);
    setTemplatePickerAnchorId(null);
  };

  const doSaveTemplate = () => {
    const name = templateSaveName.trim();
    if (!name || !page) return;
    // Save all blocks except trailing blank text lines (not the title/icon).
    const contentBlocks = blocks.filter((b) => !isBlankTextBlock(b));
    const tpl = {
      id: window.nid(),
      name,
      blocks: cloneBlocksWithNewIds(contentBlocks),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    let list = [];
    try { list = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch {}
    list.push(tpl);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
    setTemplates([...list]);
    setSaveTemplateOpen(false);
    setTemplateSaveName("");
  };

  const doDeleteTemplate = (id) => {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch {}
    list = list.filter((t) => t.id !== id);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
    setTemplates([...list]);
  };

  const doRenameTemplate = (id) => {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch {}
    const tpl = list.find((t) => t.id === id);
    if (!tpl) return;
    const nextName = prompt("Rename template", tpl.name || "Template");
    if (nextName == null) return;
    const cleanName = nextName.trim();
    if (!cleanName) return;
    list = list.map((t) => t.id === id ? { ...t, name: cleanName } : t);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
    setTemplates([...list]);
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
      /^(#{1,3}\s|[-*]\s|(\d+|[a-z]|[ivx]{1,5})[.)]\s|>\s|\|)/im.test(trimmed)
    );
  };

  const handlePagePaste = (e) => {
    if (e.defaultPrevented) return;
    // Never hijack pastes into real form fields (e.g. the content-shoot "generate script"
    // textarea, workspace name inputs). Let them handle paste natively.
    if (e.target?.closest?.('textarea, input, select, [data-native-paste="true"]')) return;
    // Never hijack pastes inside a table cell — the cell's own editor should handle it,
    // otherwise pasting a list into a cell dumps the blocks *below* the whole table.
    if (e.target?.closest?.('td, th')) return;
    if (!page || page.system || !window.parseMarkdownishBlocks) return;
    const text = e.clipboardData?.getData("text/plain") || "";
    const clipHtml = e.clipboardData?.getData("text/html") || "";

    // A highlighted range inside ONE editable always means replacement. Handle it
    // here so keyboard and context-menu paste behave identically even when the
    // browser reports `.page-body` (not the editable) as the event target.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const nodeEl = (node) => node && (node.nodeType === 1 ? node : node.parentElement);
      const startEditable = nodeEl(range.startContainer)?.closest?.(".editable");
      const endEditable = nodeEl(range.endContainer)?.closest?.(".editable");
      // The selection is the authority. Context-menu paste and some browser paths
      // target `.page-body` even though the live range is inside the editor.
      if (startEditable && startEditable === endEditable && window.replaceEditableSelection?.(startEditable, selection, text, clipHtml)) {
        e.preventDefault();
        e.stopPropagation();
        startEditable.dispatchEvent(new Event("input", { bubbles:true }));
        return;
      }
    }

    // (-1) Exact payload from WAULT's own copy handler (custom clipboard type).
    let parsedBlocks = window.readWaultClipboardPayload ? window.readWaultClipboardPayload(e) : null;

    // (0) FAITHFUL internal paste: if this is exactly what we copied inside WAULT,
    //     restore the stored blocks verbatim — immune to OS clipboard mangling.
    if (!parsedBlocks) parsedBlocks = window.matchWaultClipboard ? window.matchWaultClipboard(text) : null;

    // Prefer HTML parsing for rich-text sources (Notion, Google Docs, Word).
    // Fall back to plain-text markdown parsing for ChatGPT / raw markdown.
    if (!parsedBlocks && clipHtml && window.parseHtmlBlocks) {
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

  // ── Table cell-range selection (drag across multiple cells) ──────────────
  const clearCellHighlight = () => {
    const pb = pageBodyRef.current;
    if (pb) pb.querySelectorAll(".cell-selected").forEach((c) => c.classList.remove("cell-selected"));
    cellSelRef.current = null;
  };
  const applyCellRange = (tableEl, startCell, endCell) => {
    const rows = [...tableEl.querySelectorAll("tr")];
    const rowOf = (cell) => rows.findIndex((r) => r.contains(cell));
    const colOf = (cell) => { const tr = cell.closest("tr"); return tr ? [...tr.children].indexOf(cell) : -1; };
    const r0 = rowOf(startCell), r1 = rowOf(endCell), c0 = colOf(startCell), c1 = colOf(endCell);
    if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return;
    const rMin = Math.min(r0, r1), rMax = Math.max(r0, r1), cMin = Math.min(c0, c1), cMax = Math.max(c0, c1);
    const pb = pageBodyRef.current;
    if (pb) pb.querySelectorAll(".cell-selected").forEach((c) => c.classList.remove("cell-selected"));
    const matrix = [];
    for (let r = rMin; r <= rMax; r++) {
      const cells = [...rows[r].children];
      const rowCells = [];
      for (let c = cMin; c <= cMax; c++) {
        const cell = cells[c];
        if (cell && (cell.tagName === "TD" || cell.tagName === "TH") && cell.querySelector(".editable")) {
          cell.classList.add("cell-selected");
          rowCells.push(cell);
        }
      }
      if (rowCells.length) matrix.push(rowCells);
    }
    cellSelRef.current = matrix.length ? { matrix } : null;
  };

  // Cell under (x,y) within this table, or the nearest one (0 distance = inside).
  // Used to clamp an in-table drag so the selection can never escape the table.
  const nearestCellInTable = (table, x, y) => {
    const cells = [...table.querySelectorAll("td, th")].filter((c) => c.querySelector(".editable"));
    let best = null, bestDist = Infinity;
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
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
    clearCellHighlight();
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

  const editableOf = (node) => {
    if (!node) return null;
    const el = node.nodeType === 1 ? node : node.parentElement;
    return el?.closest?.(".editable") || null;
  };

  const beginNaturalTextSelection = (e) => {
    const pageBody = pageBodyRef.current;
    if (!pageBody || e.button !== 0 || e.defaultPrevented) return;
    if (!pageBody.contains(e.target)) return;
    const blocked = e.target.closest?.("button, input, textarea, select, .block-handle, .block-delete-btn, .tbl-rowhandle, .tbl-colhandle, .tbl-resize-handle, .tbl-add-edge, .tbl-menu, .task-category-select, .calendar-month-input");
    if (blocked) return;
    const startRange = rangeFromPoint(e.clientX, e.clientY);
    if (!startRange || !pageBody.contains(startRange.startContainer)) return;
    // Starting a fresh drag/click clears any prior block- or cell-level highlight.
    if (multiSelectedIdsRef.current.size) setMultiSelectedIds(new Set());
    clearCellHighlight();
    textSelectionDragRef.current = {
      startRange,
      startEditable: editableOf(startRange.startContainer),
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
      const endEditable = editableOf(endRange.startContainer);
      drag.active = true;

      // (1) Same editable → native browser selection (smooth, character-accurate).
      if (endEditable && endEditable === drag.startEditable) {
        if (multiSelectedIdsRef.current.size) setMultiSelectedIds(new Set());
        clearCellHighlight();
        return; // native selection does the work
      }

      // (2) Drag began inside a TABLE → the selection MUST stay inside that table
      //     as a clean rectangular cell range. This is the fix for the highlight
      //     bleeding across neighbouring cells/columns: previously, any frame where
      //     the pointer didn't resolve to a cell in the same table fell through to
      //     the cross-block native-selection path (3) below, which paints a raw
      //     browser selection across every cell between the two points. Now an
      //     in-table drag is always contained: the end cell is clamped to the
      //     nearest cell in the start table when the pointer is between cells or has
      //     left the table, and we never produce a cross-block native range.
      const startCell = drag.startEditable?.closest?.("td, th");
      const startTable = startCell?.closest?.("table");
      if (startTable && startCell) {
        let endCell = endEditable?.closest?.("td, th");
        if (!endCell || endCell.closest("table") !== startTable) {
          endCell = nearestCellInTable(startTable, e.clientX, e.clientY) || startCell;
        }
        drag.crossBlockRange = null; // never re-assert a native range on mouseup
        if (endCell && endCell !== startCell) {
          // Crossed into another cell → highlight just the dragged rectangle.
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
          if (multiSelectedIdsRef.current.size) setMultiSelectedIds(new Set());
          applyCellRange(startTable, startCell, endCell);
        } else {
          // Still within the start cell → leave native character-level selection
          // to do the work; just make sure no stray cell-range/native bleed remains.
          clearCellHighlight();
        }
        return;
      }

      // (3) Crossing block boundaries (body content) → build a real character-level
      //     Range from the drag start point to the current point. selection.extend()
      //     refuses to cross editing hosts, but a manually constructed Range spans
      //     separate contenteditable blocks and the browser renders it as one
      //     continuous highlight — exactly like Google Docs / Notion.
      e.preventDefault();
      clearCellHighlight();
      if (multiSelectedIdsRef.current.size) setMultiSelectedIds(new Set());
      const sNode = drag.startRange.startContainer, sOff = drag.startRange.startOffset;
      const eNode = endRange.startContainer, eOff = endRange.startOffset;
      const sel = window.getSelection();
      const range = document.createRange();
      try {
        const startFirst = (sNode === eNode)
          ? sOff <= eOff
          : !!(sNode.compareDocumentPosition(eNode) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (startFirst) { range.setStart(sNode, sOff); range.setEnd(eNode, eOff); }
        else { range.setStart(eNode, eOff); range.setEnd(sNode, sOff); }
        sel.removeAllRanges();
        sel.addRange(range);
        // Remember this cross-block range so we can re-assert it on mouseup — the
        // browser otherwise finalises its OWN (block-clamped) selection on mouseup
        // and wipes ours, which made the highlight vanish instantly.
        drag.crossBlockRange = range.cloneRange();
      } catch { /* point landed outside a text node — ignore this frame */ }
    };
    const onUp = () => {
      const drag = textSelectionDragRef.current;
      textSelectionDragRef.current = null;
      const saved = drag && drag.crossBlockRange;
      if (!saved) return;
      // Re-apply after the browser's native mouseup selection settles, so the
      // cross-block highlight persists and stays copyable (no jerk / no cancel).
      const reapply = () => {
        try {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(saved.cloneRange());
        } catch (_) {}
      };
      reapply();
      requestAnimationFrame(reapply);
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
    if (!page || page.system || ids.length < 1) return;
    const selected = new Set(ids);
    // Protect live sub-page links — never bulk-delete a link whose sub-page still exists.
    const protectedLink = (b) => b.type === 'subpage' && data?.pages?.[b.pageId];
    blocks.forEach((b) => { if (selected.has(b.id) && protectedLink(b)) selected.delete(b.id); });
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

  // Heartbeat: re-broadcast presence every ~12s while the user keeps editing the
  // same block, so the soft-lock doesn't expire (stale after 30s) mid-typing.
  const presenceBlockRef = useRef(null);
  const presenceTimerRef = useRef(null);
  const presenceClearTimerRef = useRef(null); // 800ms debounce so focus transitions don't flicker

  const broadcastPresence = (blockId) => {
    if (!authUser?.uid || !activeWorkspaceId || !window.WorkspaceFirebaseSync?.setPresence) return;
    // Cancel any pending clear — we're still editing
    if (presenceClearTimerRef.current) { clearTimeout(presenceClearTimerRef.current); presenceClearTimerRef.current = null; }
    window.WorkspaceFirebaseSync.setPresence(activeWorkspaceId, authUser.uid, blockId, authUser.email, {
      displayName: authUser.displayName || '',
      photoURL: authUser.photoURL || '',
      sessionId: window._wnSessionId || authUser.uid, // stable per-tab key
    });
  };

  const markEditingBlock = (blockId) => {
    if (!page || page.system) return;
    window.WorkspaceStore?.setEditingBlock?.(page.id, blockId);
    presenceBlockRef.current = blockId;
    broadcastPresence(blockId);
    // Keep the lock fresh while editing continues
    if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    presenceTimerRef.current = setInterval(() => {
      if (presenceBlockRef.current) broadcastPresence(presenceBlockRef.current);
    }, 12000);
  };

  const clearEditingBlock = () => {
    window.WorkspaceStore?.clearEditingBlock?.();
    presenceBlockRef.current = null;
    if (presenceTimerRef.current) { clearInterval(presenceTimerRef.current); presenceTimerRef.current = null; }
    // Debounce the Firebase clear by 800ms — focus transitions (click from one block to another)
    // briefly lose focus, which would cause a flicker if we cleared immediately.
    if (presenceClearTimerRef.current) clearTimeout(presenceClearTimerRef.current);
    presenceClearTimerRef.current = setTimeout(() => {
      presenceClearTimerRef.current = null;
      if (authUser?.uid && activeWorkspaceId && window.WorkspaceFirebaseSync?.clearPresence) {
        const sessionId = window._wnSessionId || authUser.uid;
        window.WorkspaceFirebaseSync.clearPresence(activeWorkspaceId, authUser.uid, sessionId);
      }
    }, 800);
  };

  // Reliability: re-assert our presence when the tab regains focus. A backgrounded
  // tab's presence entry can be removed by onDisconnect or go stale (>30s), which is
  // why teammates intermittently couldn't see who was editing without a reload.
  // Re-broadcasting the current editing block on focus restores the live indicator.
  useEffect(() => {
    const reassert = () => {
      if (document.visibilityState !== "visible") return;
      if (presenceBlockRef.current) broadcastPresence(presenceBlockRef.current);
    };
    document.addEventListener("visibilitychange", reassert);
    window.addEventListener("focus", reassert);
    return () => {
      document.removeEventListener("visibilitychange", reassert);
      window.removeEventListener("focus", reassert);
    };
  }, [authUser?.uid, activeWorkspaceId]);

  // Return null (not a visible "No page selected" div) so there's no flash during rapid nav
  if (!page) return null;
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
          <PageIconPicker
            icon={page.icon}
            onChange={(v) => updatePage(page.id, { icon: v })}
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
          <div className="page-header-actions">
            <button
              className="page-tpl-btn"
              type="button"
              title="Browse and insert one of your saved templates"
              onClick={() => openTemplatePicker(null)}
            >
              ❏ Templates
            </button>
            <button
              className="page-tpl-btn page-tpl-save-btn"
              type="button"
              title="Save this page's content as a reusable template (excludes title & icon)"
              onClick={() => {
                const t = window.stripHtml ? window.stripHtml(page.title || "") : (page.title || "");
                setTemplateSaveName(t);
                setSaveTemplateOpen(true);
              }}
            >
              + Save as template
            </button>
            <button
              className="page-pdf-btn"
              type="button"
              title="Download as PDF"
              onClick={downloadPageAsPdf}
            >
              ↓ PDF
            </button>
          </div>
        </div>

        <div
          ref={pageBodyRef}
          className={`page-body ${marquee ? "selecting-blocks" : ""}`}
          onMouseDownCapture={beginNaturalTextSelection}
          onMouseDown={beginBlockMarquee}
          onPasteCapture={handlePagePaste}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock) focusBlock(lastBlock.id);
          }}
          onKeyDownCapture={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
              e.preventDefault();
              e.stopPropagation();
              selectAllBlocks();
              return;
            }
            if (e.key !== "Backspace" && e.key !== "Delete") return;
            // Only an EXPLICIT block-marquee/handle selection deletes whole blocks.
            // A plain text highlight (even one spanning blocks/rows) is handled by
            // the range-aware deleter so exactly the highlighted span is removed.
            const ids = multiSelectedIds.size ? [...multiSelectedIds] : [];
            if (ids.length < 1) return;
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
              focusAtStart={focusBlockId === block.id && focusAtStart}
              isLast={idx === blocks.length - 1}
              multiSelected={multiSelectedIds.has(block.id)}
              updateBlock={updateBlock}
              patchBlock={patchBlock}
              data={data}
              pageBlocks={blocks}
              setCurrentPage={setCurrentPage}
              updateEvents={updateEvents}
              lockedBy={presenceLocks[block.id]}
              onBeginEditing={() => markEditingBlock(block.id)}
              onEndEditing={clearEditingBlock}
              onDeleteEmpty={() => deleteEmptyBlock(block.id)}
              onDeleteBlock={() => deleteBlock(block.id)}
              onConvertToText={(text) => convertBlockToText(block.id, text)}
              onMarkdownShortcut={(shortcut) => {
                const type = typeof shortcut === "string" ? shortcut : shortcut?.type;
                const remainingHtml = typeof shortcut === "object" ? (shortcut.remainingHtml || "") : "";
                if (type === "bullets") {
                  replaceBlock(block.id, { id: block.id, type:"bullets", items:[{ id: window.nid(), text:remainingHtml }] });
                }
                if (type === "numbers") {
                  replaceBlock(block.id, { id: block.id, type:"numbers", items:[{ id: window.nid(), text:remainingHtml }] });
                }
                if (type === "checklist") {
                  replaceBlock(block.id, { id: block.id, type:"checklist", items:[{ id: window.nid(), text:"", done:false, dueDate:"" }] });
                }
                if (type === "heading1" || type === "heading2" || type === "heading3") {
                  const level = parseInt(type.slice(-1), 10);
                  replaceBlock(block.id, { id: block.id, type:"heading", level, text:"" });
                }
                focusBlock(block.id, type === "bullets" || type === "numbers");
              }}
              onReplaceBlock={(replacementBlocks, focusId) => replaceBlockWithBlocks(block.id, replacementBlocks, focusId)}
              onDragBlockStart={(id) => setDragBlockId(id)}
              onDragBlockEnd={() => setDragBlockId(null)}
              onDropBlock={(targetId, position) => handleBlockDrop(targetId, position)}
              onAddBlockAfter={(tailText) => {
                const id = window.nid();
                addBlockAfter(block.id, { id, type:"text", text: tailText || "" });
                focusBlock(id, true); // cursor at start of tail text
              }}
              onAddBlockBefore={(tailText) => {
                const id = window.nid();
                addBlockBefore(block.id, { id, type:"text", text: tailText || "" });
                // Cursor stays in the current block (Notion behaviour: Enter at pos 0
                // inserts a blank line above but the caret doesn't move up).
                focusBlock(block.id, true);
              }}
              onMoveToPreviousBlock={(mode) => moveToPreviousBlock(block.id, mode)}
              onMoveToNextBlock={(mode) => moveToNextBlock(block.id, mode)}
              onMergeNextBlock={() => mergeNextBlockIn(block.id)}
              onExitBlock={(updatedBlock) => exitBlockToText(block.id, updatedBlock)}
              onSlashCommandShow={(query, rect, clearCb, anchorEl) => {
                showSlash(query, rect, (cmd) => {
                  // A specific template chosen from the slash submenu → insert it here.
                  if (cmd.openTemplate && cmd.template) {
                    clearCb();
                    const fresh = cloneBlocksWithNewIds(cmd.template.blocks);
                    if (fresh.length) { replaceBlockWithBlocks(block.id, fresh, fresh[0].id); focusBlock(fresh[0].id); }
                    return;
                  }
                  // User-defined templates → open picker, replace this block on apply.
                  if (cmd.openTemplate) {
                    clearCb();
                    openTemplatePicker(block.id);
                    return;
                  }
                  // Multi-block templates (e.g., Content Shooting)
                  if (cmd.makeMany) {
                    const newBlocks = cmd.makeMany();
                    if (newBlocks?.length) {
                      replaceBlockWithBlocks(block.id, newBlocks, newBlocks[0].id);
                      focusBlock(newBlocks[0].id);
                    }
                    return;
                  }
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

          {/* Guided empty state: a brand-new page offers three starters instead of a
              dead blank line. It disappears the moment the user types anything. */}
          {!page.system && blocks.length === 1 && blocks[0].type === "text" &&
            !(window.stripHtml ? window.stripHtml(blocks[0].text || "") : (blocks[0].text || "")).trim() && (
            <div className="empty-page-actions">
              <button type="button" onClick={() => openTemplatePicker(blocks[0].id)}>
                <span className="epa-icon">❏</span> Start from a template
              </button>
              <button
                type="button"
                onClick={() => {
                  const tbl = { id: window.nid(), type: "table", headers: ["Col 1", "Col 2", "Col 3"], rows: [{ id: window.nid(), cells: ["", "", ""] }] };
                  const txt = { id: window.nid(), type: "text", text: "" };
                  replaceBlockWithBlocks(blocks[0].id, [tbl, txt], txt.id);
                }}
              >
                <span className="epa-icon">▦</span> Insert a table
              </button>
              <button
                type="button"
                onClick={() => {
                  const todo = { id: window.nid(), type: "checklist", items: [{ id: window.nid(), text: "", done: false, dueDate: "" }] };
                  replaceBlockWithBlocks(blocks[0].id, [todo], todo.id);
                }}
              >
                <span className="epa-icon">☑</span> Start a to-do list
              </button>
              <span className="empty-page-tip">…or just write. Type <b>/</b> for every block.</span>
            </div>
          )}

          {/* Bottom click target: clicking empty space below blocks focuses the last block */}
          <div
            style={{ minHeight: 120, cursor: "text" }}
            onClick={() => {
              const lastBlock = blocks[blocks.length - 1];
              if (lastBlock) focusBlock(lastBlock.id);
            }}
          />

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
            key={title}
            title={title}
            className={`fmt-bar-btn${active ? " active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
          >{label}</button>
        );
        // Live inline-style state so B/I/U/S light up when the selection already has them.
        const q = (cmd) => { try { return document.queryCommandState(cmd); } catch { return false; } };
        const execFmt = (cmd) => { document.execCommand(cmd); setFormatBar((b) => (b ? { ...b } : b)); };
        return (
          <div className="fmt-bar" style={{ position:"fixed", left: barLeft, top: barTop, zIndex:9999 }}>
            {btn(<b>B</b>, q("bold"),      () => execFmt("bold"),          "Bold  ⌘B")}
            {btn(<i>I</i>, q("italic"),    () => execFmt("italic"),        "Italic  ⌘I")}
            {btn(<u>U</u>, q("underline"), () => execFmt("underline"),     "Underline  ⌘U")}
            {btn(<s>S</s>, q("strikeThrough"), () => execFmt("strikeThrough"), "Strikethrough")}
            <span className="fmt-bar-sep" />
            {btn("Text", cur === "text",                        () => convertBlockType(formatBar.blockId, "text"),      "Text")}
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

      {blockMenu && (() => {
        const b = blocks.find((x) => x.id === blockMenu.blockId);
        if (!b) return null;
        const canConvert = ["text", "heading", "bullets", "numbers", "checklist", "callout"].includes(b.type);
        const MENU_W = 232;
        const left = Math.min(blockMenu.x, window.innerWidth - MENU_W - 10);
        const top = Math.min(blockMenu.y + 4, window.innerHeight - 360);
        const turn = (type, level) => { convertBlockType(blockMenu.blockId, type, level); closeBlockMenu(); };
        const Item = ({ icon, label, onClick, danger }) => (
          <button className={`blockmenu-item${danger ? " danger" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={onClick} type="button">
            <span className="blockmenu-ico" dangerouslySetInnerHTML={{ __html: icon }} />
            <span>{label}</span>
          </button>
        );
        const I = {
          copy: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M4 13V5a2 2 0 0 1 2-2h6"/></svg>',
          dup: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="10" height="10" rx="2"/><path d="M7 17h8a2 2 0 0 0 2-2V7"/></svg>',
          del: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>',
          text: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h12M10 5v11"/></svg>',
          h1: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v12M11 4v12M4 10h7M15 8v8M15 8l-1.5 1"/></svg>',
          h2: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4v12M9 4v12M3 10h6M13 9c0-1 .8-2 2-2s2 .8 2 2c0 1.6-4 2.6-4 5h4"/></svg>',
          h3: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4v12M9 4v12M3 10h6M13 8c2-1 4 0 4 1.6 0 1-1 1.6-2 1.6 1 0 2 .6 2 1.8C17 16 15 16.6 13 16"/></svg>',
          bullet: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="6" r="1"/><circle cx="4" cy="14" r="1"/><path d="M8 6h9M8 14h9"/></svg>',
          number: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h9M8 14h9M3 4l1.5-.5V8M3 8h3"/></svg>',
          todo: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="M4.5 7l1 1 2-2.2M12 6h5M12 13h5"/></svg>',
          quote: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5v10M9 7c-1 0-2 .8-2 2.2M16 7c-1 0-2 .8-2 2.2"/></svg>',
          header: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M3 8h14M8 4v12"/></svg>',
        };
        return (
          <>
            <div className="blockmenu-backdrop" onMouseDown={closeBlockMenu} />
            <div className="blockmenu" style={{ position: "fixed", left, top, width: MENU_W, zIndex: 10001 }}>
              <Item icon={I.dup} label="Duplicate" onClick={() => { duplicateBlock(blockMenu.blockId); closeBlockMenu(); }} />
              <Item icon={I.copy} label="Copy" onClick={() => { copyBlockToClipboard(blockMenu.blockId); closeBlockMenu(); }} />
              <Item icon={I.del} label="Delete" danger onClick={() => { deleteBlock(blockMenu.blockId); closeBlockMenu(); }} />
              {b.type === "table" && <div className="blockmenu-sep" />}
              {b.type === "table" && <div className="blockmenu-label">Table</div>}
              {b.type === "table" && <Item icon={I.header} label={`${b.headerRow ? "✓  " : ""}Header row`} onClick={() => { updateBlock({ ...b, headerRow: !b.headerRow }); closeBlockMenu(); }} />}
              {canConvert && <div className="blockmenu-sep" />}
              {canConvert && <div className="blockmenu-label">Turn into</div>}
              {canConvert && <Item icon={I.text} label="Text" onClick={() => turn("text")} />}
              {canConvert && <Item icon={I.h1} label="Heading 1" onClick={() => turn("heading", 1)} />}
              {canConvert && <Item icon={I.h2} label="Heading 2" onClick={() => turn("heading", 2)} />}
              {canConvert && <Item icon={I.h3} label="Heading 3" onClick={() => turn("heading", 3)} />}
              {canConvert && <Item icon={I.bullet} label="Bulleted list" onClick={() => turn("bullets")} />}
              {canConvert && <Item icon={I.number} label="Numbered list" onClick={() => turn("numbers")} />}
              {canConvert && <Item icon={I.todo} label="To-do list" onClick={() => turn("checklist")} />}
              {canConvert && <Item icon={I.quote} label="Callout" onClick={() => turn("callout")} />}
            </div>
          </>
        );
      })()}

      {templatePickerOpen && (
        <div className="modal-overlay" onMouseDown={() => setTemplatePickerOpen(false)}>
          <div className="template-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <span>Templates</span>
              <button className="template-modal-close" onClick={() => setTemplatePickerOpen(false)}>×</button>
            </div>
            <div className="template-list">
              {/* Built-in templates — always available */}
              {getBuiltinTemplates().map((tpl) => (
                <div key={tpl.id} className="template-item" onClick={() => doApplyTemplate(tpl)}>
                  <div className="template-item-icon">{tpl.icon || "❏"}</div>
                  <div className="template-item-info">
                    <div className="template-item-name">{tpl.name}</div>
                    <div className="template-item-meta">Built-in template</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>Built-in</span>
                </div>
              ))}

              {/* User templates */}
              {templates.length > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "12px 4px 6px" }}>
                  Your templates
                </div>
              )}
              {templates.map((tpl) => (
                <div key={tpl.id} className="template-item" onClick={() => doApplyTemplate(tpl)}>
                  <div className="template-item-icon">❏</div>
                  <div className="template-item-info">
                    <div className="template-item-name">{tpl.name}</div>
                    <div className="template-item-meta">{(tpl.blocks || []).length} blocks · {tpl.createdAt}</div>
                  </div>
                  <button
                    className="template-item-del"
                    title="Rename template"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); doRenameTemplate(tpl.id); }}
                  >✎</button>
                  <button
                    className="template-item-del"
                    title="Delete template"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); doDeleteTemplate(tpl.id); }}
                  >×</button>
                </div>
              ))}

              {/* Hint when user has no saved templates of their own */}
              {templates.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, padding: "12px 4px 4px", borderTop: "1px solid var(--line-soft)", marginTop: 8 }}>
                  Design any page, then click <strong>+ Save as template</strong> in the page header to add your own here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {saveTemplateOpen && (
        <div className="modal-overlay" onMouseDown={() => setSaveTemplateOpen(false)}>
          <div className="template-modal save-template-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <span>Save as Template</span>
              <button className="template-modal-close" onClick={() => setSaveTemplateOpen(false)}>×</button>
            </div>
            <div className="template-modal-body">
              <p className="template-save-hint">Saves this page's blocks (not the title or icon). Insert anytime from <strong>Templates</strong> or by typing <strong>/template</strong>.</p>
              <input
                className="template-name-input"
                placeholder="Template name…"
                value={templateSaveName}
                onInput={(e) => setTemplateSaveName(e.target.value)}
                onChange={(e) => setTemplateSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doSaveTemplate(); if (e.key === "Escape") setSaveTemplateOpen(false); }}
                autoFocus
              />
              <div className="template-save-actions">
                <button className="template-cancel-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setSaveTemplateOpen(false)}>Cancel</button>
                <button className="template-confirm-btn" onMouseDown={(e) => e.preventDefault()} onClick={doSaveTemplate}>Save Template</button>
              </div>
            </div>
          </div>
        </div>
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
