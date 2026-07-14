/* global React */
// ============================================================================
// WAULT FOCUS — the in-app homepage ("Home" system page).
// Ported from focus/focus-app.jsx to run INSIDE the main app's React tree:
//  - auth / theme / firebase come from the host app (no Gate, no theme toggle)
//  - active-workspace data arrives live via props (no localStorage polling)
//  - completing a document-sourced task calls completeChecklistItem (host
//    setData) instead of writing workspace localStorage directly
//  - a reconcile effect flips tasks when checklist items change in the editor
//    (transition-detection: loop-safe by construction)
// Exports: window.FocusHome
// ============================================================================

(() => {
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const nid = () => `fx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function dateKeyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const todayKey = () => dateKeyOf(new Date());
const addDays = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateKeyOf(dt);
};

function prettyDate(key) {
  try {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch { return key; }
}
function shortDate(key) {
  try {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const now = new Date();
    return dt.toLocaleDateString(undefined, dt.getFullYear() === now.getFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" });
  } catch { return key; }
}

// A pulled task's sourceLabel is "Page title · Workspace". Show just the
// workspace name on the right of the row so you can see where it's from.
function sourceWsLabel(label) {
  if (!label) return "";
  const parts = String(label).split("·");
  return (parts[parts.length - 1] || label).trim();
}
function agoLabel(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!(ms >= 0)) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function fxStripHtml(html) {
  if (!html) return "";
  if (!/[<&]/.test(html)) return String(html).trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

const LS_TASKS = "wault_focus_tasks_v2";
const LS_MIGRATED = "wault_focus_migrated_v2";
const LS_SEEDED = "wault_focus_seeded_v1";   // sourceIds already auto-pulled (don't resurrect deleted ones)
const LS_DELETED = "wault_focus_deleted_v1"; // recent user-deleted task/source ids (guards cloud/listener races)
const LS_PINSEED = "wault_focus_pinseed_v1"; // { date, userUnpinned:[] } for auto-fill of Today's Priorities
const LS_DAYS = "wault_focus_days";       // legacy (3-priority ritual) — read-only for migration
const LS_LATER = "wault_focus_later";     // legacy — migrated into tasks
const wsDataKey = (id) => `workspace_v4_data_${id}`;
const wsSavedAtKey = (id) => `${id}_local_saved_at`;
const FOCUS_DELETE_TOMBSTONE_MS = 30 * 24 * 60 * 60 * 1000;

function getSessionId() {
  try {
    let s = sessionStorage.getItem("fx_session");
    if (!s) { s = nid(); sessionStorage.setItem("fx_session", s); }
    return s;
  } catch { return nid(); }
}
const SESSION_ID = getSessionId();

// Last-seen checklist done-state of the active workspace ({ wsId, map }).
// Module-level on purpose: survives FocusHome unmount/remount, so edits made
// in the editor are detected as transitions when the user returns Home.
let lastDoneMap = null;

// ── Task model ───────────────────────────────────────────────────────────────
function makeTask(patch = {}) {
  const now = new Date().toISOString();
  return {
    id: nid(),
    title: "",
    status: "todo",            // todo | in_progress | waiting | done
    priority: "medium",        // high | medium | low
    dueDate: "",
    sourceType: "focus",       // focus | document
    sourceId: "",
    sourceLabel: "",
    workspaceId: "",           // manual task grouping; blank = Personal / Focus
    workspaceName: "",
    pinnedDate: "",            // YYYY-MM-DD when pinned to "Today's Priorities"
    notes: "",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...patch,
  };
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

// The whole point: the app decides where a task belongs — purely by its date.
function bucketOf(task, today) {
  if (task.status === "done") return "done";
  if (task.status === "waiting") return "waiting";       // shown as "On Hold"
  if (task.dueDate && task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";            // Due Today
  if (task.dueDate && task.dueDate > today) return "upcoming";
  return "nodate";                                       // no due date
}

function taskOrder(a, b) {
  const ad = a.dueDate || "9999-99-99";
  const bd = b.dueDate || "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  const ap = PRIORITY_RANK[a.priority] ?? 1;
  const bp = PRIORITY_RANK[b.priority] ?? 1;
  if (ap !== bp) return ap - bp;
  return String(a.createdAt).localeCompare(String(b.createdAt));
}

// ── Quick-add token parser:  "ship report !high tomorrow"  ──────────────────
const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function parseQuickAdd(raw) {
  let text = ` ${String(raw || "").trim()} `;
  let priority = "";
  let dueDate = "";
  const eat = (re, fn) => {
    const m = text.match(re);
    if (m) { fn(m); text = text.replace(re, " "); }
  };
  eat(/\s!(high|h)(?=\s)/i, () => { priority = "high"; });
  eat(/\s!(med|medium|m)(?=\s)/i, () => { priority = "medium"; });
  eat(/\s!(low|l)(?=\s)/i, () => { priority = "low"; });
  eat(/\s(\d{4}-\d{2}-\d{2})(?=\s)/, (m) => { dueDate = m[1]; });
  if (!dueDate) eat(/\s(today)(?=\s)/i, () => { dueDate = todayKey(); });
  if (!dueDate) eat(/\s(tomorrow|tmr)(?=\s)/i, () => { dueDate = addDays(todayKey(), 1); });
  if (!dueDate) {
    const wd = text.match(/\s(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|sday|nesday|rsday|urday)?(?=\s)/i);
    if (wd) {
      const stem = wd[1].toLowerCase().slice(0, 3);
      const target = WEEKDAYS.findIndex((w) => w.startsWith(stem));
      if (target >= 0) {
        const now = new Date();
        let diff = (target - now.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        dueDate = addDays(todayKey(), diff);
        text = text.replace(wd[0], " ");
      }
    }
  }
  return { title: text.replace(/\s+/g, " ").trim(), priority: priority || "medium", dueDate, hadPriority: !!priority };
}

// ── Cloud sync (focus/$uid/tasks) ────────────────────────────────────────────
const focusTaskWriteQueues = new Map();
function enqueueFocusTaskWrite(taskId, writer) {
  const previous = focusTaskWriteQueues.get(taskId) || Promise.resolve();
  const next = previous.catch(() => {}).then(writer);
  focusTaskWriteQueues.set(taskId, next);
  const cleanup = () => {
    if (focusTaskWriteQueues.get(taskId) === next) focusTaskWriteQueues.delete(taskId);
  };
  next.then(cleanup, cleanup);
  return next;
}

async function cloudLoadTasks(fb, uid) {
  try {
    const snap = await fb.get(fb.ref(fb.database, `focus/${uid}/tasks`));
    return snap.exists() ? (snap.val() || {}) : {};
  } catch (e) {
    console.warn("FocusHome: cloud load failed:", e.message);
    return null;
  }
}
function focusTaskAuditContext(uid, task, taskId = task?.id || "") {
  const sourceParts = String(task?.sourceId || "").split(":");
  const workspaceId = task?.sourceType === "document" && sourceParts[0]
    ? sourceParts[0]
    : (task?.workspaceId || `focus_${uid}`);
  return {
    workspaceId,
    documentId: task?.sourceType === "document" ? (sourceParts[1] || "") : "",
    taskId,
    databasePath: `focus/${uid}/tasks/${taskId}`,
  };
}
function cloudSaveTask(fb, uid, task) {
  if (!fb || !uid || !task?.id) return Promise.resolve(true);
  return enqueueFocusTaskWrite(task.id, async () => {
    const context = focusTaskAuditContext(uid, task);
    await fb.set(fb.ref(fb.database, context.databasePath), task);
    await fb.writeAuditLog?.("focus_task_upsert", context.workspaceId, {
      path: context.databasePath,
      documentId: context.documentId,
      taskId: context.taskId,
      payloadSummary: {
        titleChars: String(task.title || "").length,
        status: task.status || "",
        sourceType: task.sourceType || "focus",
      },
    });
  })
    .then(() => true)
    .catch((e) => {
      console.warn("FocusHome: task save failed:", e.message);
      return false;
    });
}
// Stamp a task with this session's id before storing it ANYWHERE (local + cloud
// hold identical copies): saveId lets the live listener skip our own echoes and
// protects this session's fresh tasks from stale remote-deletion snapshots.
const stamped = (task) => ({ ...task, saveId: SESSION_ID, updatedAt: new Date().toISOString() });
function cloudDeleteTask(fb, uid, taskId, task = null) {
  if (!fb || !uid || !taskId) return Promise.resolve(true);
  return enqueueFocusTaskWrite(taskId, async () => {
    const context = focusTaskAuditContext(uid, task, taskId);
    await fb.set(fb.ref(fb.database, context.databasePath), null);
    await fb.writeAuditLog?.("focus_task_delete", context.workspaceId, {
      path: context.databasePath,
      documentId: context.documentId,
      taskId: context.taskId,
      payloadSummary: { sourceType: task?.sourceType || "focus" },
    });
  })
    .then(() => true)
    .catch((e) => {
      console.warn("FocusHome: task delete failed:", e.message);
      return false;
    });
}

function focusFirebaseSaveSucceeded(result) {
  return window.WaultReliability?.firebaseSaveSucceeded
    ? window.WaultReliability.firebaseSaveSucceeded(result)
    : (result === true || result?.ok === true);
}

function parseSourceId(sourceId) {
  const [wsId, pageId, itemId] = String(sourceId || "").split(":");
  return { wsId, pageId, itemId };
}

function readFocusDeleteTombstones() {
  const now = Date.now();
  const raw = readJson(LS_DELETED, {}) || {};
  const out = {
    taskIds: raw.taskIds && typeof raw.taskIds === "object" ? { ...raw.taskIds } : {},
    sourceIds: raw.sourceIds && typeof raw.sourceIds === "object" ? { ...raw.sourceIds } : {},
  };
  let changed = false;
  ["taskIds", "sourceIds"].forEach((key) => {
    Object.entries(out[key]).forEach(([id, ts]) => {
      if (!ts || now - Number(ts) > FOCUS_DELETE_TOMBSTONE_MS) {
        delete out[key][id];
        changed = true;
      }
    });
  });
  if (changed) writeJson(LS_DELETED, out);
  return out;
}

function rememberDeletedFocusTasks(tasks) {
  const list = (Array.isArray(tasks) ? tasks : [tasks]).filter(Boolean);
  if (!list.length) return;
  const tombstones = readFocusDeleteTombstones();
  const now = Date.now();
  list.forEach((task) => {
    if (task.id) tombstones.taskIds[task.id] = now;
    if (task.sourceType === "document" && task.sourceId) tombstones.sourceIds[task.sourceId] = now;
  });
  writeJson(LS_DELETED, tombstones);
}

function isDeletedFocusTask(task, tombstones = readFocusDeleteTombstones()) {
  if (!task) return false;
  return !!(
    (task.id && tombstones.taskIds[task.id]) ||
    (task.sourceType === "document" && task.sourceId && tombstones.sourceIds[task.sourceId])
  );
}

function isTaskFromWorkspace(task, workspaceId) {
  if (!task || !workspaceId) return false;
  if (task.sourceType === "document" && String(task.sourceId || "").startsWith(`${workspaceId}:`)) return true;
  return String(task.workspaceId || "") === String(workspaceId);
}

function cleanupFocusTasksForWorkspace(workspaceId, { fb = window.WorkspaceFirebaseSync, uid = "" } = {}) {
  if (!workspaceId) return [];
  const allTasks = migrateLegacy(readJson(LS_TASKS, {}));
  const removedIds = Object.values(allTasks)
    .filter((task) => isTaskFromWorkspace(task, workspaceId))
    .map((task) => task.id)
    .filter(Boolean);
  if (!removedIds.length) return [];

  const next = { ...allTasks };
  removedIds.forEach((id) => delete next[id]);
  rememberDeletedFocusTasks(removedIds.map((id) => allTasks[id]).filter(Boolean));
  writeJson(LS_TASKS, next);

  const seeded = readJson(LS_SEEDED, null);
  if (Array.isArray(seeded)) {
    writeJson(LS_SEEDED, seeded.filter((sourceId) => !String(sourceId || "").startsWith(`${workspaceId}:`)));
  }

  const resolvedUid = uid || fb?.getCurrentUser?.()?.uid || "";
  removedIds.forEach((id) => cloudDeleteTask(fb, resolvedUid, id, allTasks[id]));
  return removedIds;
}

function cleanupFocusTasksForSources(sourceIds, { fb = window.WorkspaceFirebaseSync, uid = "" } = {}) {
  const sources = new Set((Array.isArray(sourceIds) ? sourceIds : [sourceIds]).filter(Boolean));
  if (!sources.size) return [];
  const allTasks = migrateLegacy(readJson(LS_TASKS, {}));
  const removedTasks = Object.values(allTasks).filter((task) => (
    task?.sourceType === "document" && task.sourceId && sources.has(task.sourceId)
  ));
  if (!removedTasks.length) return [];

  const next = { ...allTasks };
  removedTasks.forEach((task) => { delete next[task.id]; });
  rememberDeletedFocusTasks(removedTasks);
  writeJson(LS_TASKS, next);
  const resolvedUid = uid || fb?.getCurrentUser?.()?.uid || "";
  removedTasks.forEach((task) => cloudDeleteTask(fb, resolvedUid, task.id, task));
  return removedTasks.map((task) => task.id);
}

window.WaultFocusCleanup = {
  ...(window.WaultFocusCleanup || {}),
  deleteWorkspaceTasks: cleanupFocusTasksForWorkspace,
  deleteSourceTasks: cleanupFocusTasksForSources,
};

function mergeTaskMaps(local, cloud) {
  const tombstones = readFocusDeleteTombstones();
  const out = {};
  Object.entries(local || {}).forEach(([id, t]) => {
    if (!isDeletedFocusTask({ ...t, id: t?.id || id }, tombstones)) out[id] = t;
  });
  Object.entries(cloud || {}).forEach(([id, t]) => {
    if (isDeletedFocusTask({ ...t, id: t?.id || id }, tombstones)) return;
    const cur = out[id];
    if (!cur || String(t?.updatedAt || "") > String(cur.updatedAt || "")) out[id] = t;
  });
  return out;
}

// ── Workspace integration ────────────────────────────────────────────────────
// Scan ONE workspace's data object for open checklist items.
function scanWorkspaceData(wsId, wsName, data, seen, out) {
  const pages = data?.pages;
  if (!pages) return;
  Object.values(pages).forEach((page) => {
    (page?.blocks || []).forEach((block) => {
      if (block?.type !== "checklist" || !Array.isArray(block.items)) return;
      block.items.forEach((item) => {
        if (!item || item.done) return;
        const text = fxStripHtml(item.text);
        if (!text) return;
        const key = text.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          sourceId: `${wsId}:${page.id}:${item.id}`,
          title: text,
          dueDate: item.dueDate || "",
          wsName: wsName || wsId,
          pageTitle: fxStripHtml(page.title) || "Untitled",
        });
      });
    });
  });
}

function workspaceChecklistState(wsId, data) {
  const state = new Map();
  Object.values(data?.pages || {}).forEach((page) => {
    (page?.blocks || []).forEach((block) => {
      if (block?.type !== "checklist" || !Array.isArray(block.items)) return;
      block.items.forEach((item) => {
        if (item?.id) state.set(`${wsId}:${page.id}:${item.id}`, !!item.done);
      });
    });
  });
  return state;
}

// Legacy write-back for NON-ACTIVE workspaces only (active ws goes through
// completeChecklistItem → host setData, or the host's save effect would clobber
// a direct localStorage write within 200ms).
function completeWorkspaceItem(sourceId, done) {
  try {
    const { wsId, pageId, itemId } = parseSourceId(sourceId);
    if (!wsId || !pageId || !itemId) return false;
    const data = readJson(wsDataKey(wsId), null);
    const page = data?.pages?.[pageId];
    if (!page) return false;
    let found = false;
    (page.blocks || []).forEach((b) => {
      if (b?.type !== "checklist" || !Array.isArray(b.items)) return;
      b.items.forEach((it) => {
        if (it && it.id === itemId) { it.done = !!done; found = true; }
      });
    });
    if (found) writeJson(wsDataKey(wsId), data);
    return found;
  } catch { return false; }
}

function setChecklistItemDoneInWorkspaceData(data, pageId, itemId, done) {
  const page = data?.pages?.[pageId];
  if (!page || !Array.isArray(page.blocks)) return { data, found: false };
  let found = false;
  const blocks = page.blocks.map((block) => {
    if (block?.type !== "checklist" || !Array.isArray(block.items)) return block;
    if (!block.items.some((item) => item?.id === itemId)) return block;
    found = true;
    return {
      ...block,
      items: block.items.map((item) => item?.id === itemId ? { ...item, done: !!done } : item),
    };
  });
  if (!found) return { data, found: false };
  return { data: { ...data, pages: { ...data.pages, [pageId]: { ...page, blocks } } }, found: true };
}

async function completeWorkspaceChecklistSource(sourceId, done, { fb, workspaces } = {}) {
  const { wsId, pageId, itemId } = parseSourceId(sourceId);
  if (!wsId || !pageId || !itemId) return false;
  if (!(fb?.loadWorkspace && fb?.saveWorkspace)) return completeWorkspaceItem(sourceId, done);

  let remoteRecord = await fb.loadWorkspace(wsId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!remoteRecord?.workspace?.pages) return false;
    const updated = setChecklistItemDoneInWorkspaceData(remoteRecord.workspace, pageId, itemId, done);
    if (!updated.found) return true;
    const workspace = (workspaces || []).find((entry) => entry?.id === wsId) || {};
    const saved = await fb.saveWorkspace(wsId, updated.data, SESSION_ID, {
      name: workspace.name || wsId,
      visibility: workspace.visibility || "shared",
      ownerUid: workspace.ownerUid || "",
      ownerEmail: workspace.ownerEmail || "",
      baseUpdatedAt: remoteRecord.updated_at || "",
      baseRevision: Number(remoteRecord.revision || 0),
    });
    if (focusFirebaseSaveSucceeded(saved)) {
      try {
        localStorage.setItem(wsDataKey(wsId), JSON.stringify(updated.data));
        localStorage.setItem(wsSavedAtKey(wsId), saved.updated_at || new Date().toISOString());
      } catch {}
      return true;
    }
    if (saved?.reason !== "stale_revision" || !saved.remote?.workspace) return false;
    remoteRecord = saved.remote;
  }
  return false;
}

function removeChecklistItemFromWorkspaceData(data, pageId, itemId) {
  const page = data?.pages?.[pageId];
  if (!page || !Array.isArray(page.blocks)) return { data, found: false };
  let found = false;
  const blocks = page.blocks.map((b) => {
    if (b?.type !== "checklist" || !Array.isArray(b.items)) return b;
    if (!b.items.some((it) => it && it.id === itemId)) return b;
    found = true;
    return { ...b, items: b.items.filter((it) => !(it && it.id === itemId)) };
  });
  if (!found) return { data, found: false };
  return {
    data: { ...data, pages: { ...data.pages, [pageId]: { ...page, blocks } } },
    found: true,
  };
}

async function deleteWorkspaceChecklistSource(sourceId, { activeWorkspaceId, deleteChecklistItem, fb, workspaces } = {}) {
  const { wsId, pageId, itemId } = parseSourceId(sourceId);
  if (!wsId || !pageId || !itemId) return false;

  if (wsId === activeWorkspaceId && typeof deleteChecklistItem === "function") {
    return !!(await Promise.resolve(deleteChecklistItem(pageId, itemId)));
  }

  const localData = readJson(wsDataKey(wsId), null);
  const cloudAvailable = !!(fb?.loadWorkspace && fb?.saveWorkspace);
  if (cloudAvailable) {
    let remoteRecord = await fb.loadWorkspace(wsId);
    const workspace = (workspaces || []).find((ws) => ws?.id === wsId) || {};
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!remoteRecord?.workspace?.pages) return false;
      const removed = removeChecklistItemFromWorkspaceData(remoteRecord.workspace, pageId, itemId);
      if (!removed.found) return true;
      const saved = await fb.saveWorkspace(wsId, removed.data, SESSION_ID, {
        name: workspace.name || wsId,
        visibility: workspace.visibility || "shared",
        ownerUid: workspace.ownerUid || "",
        ownerEmail: workspace.ownerEmail || "",
        baseUpdatedAt: remoteRecord.updated_at || "",
        baseRevision: Number(remoteRecord.revision || 0),
      });
      if (focusFirebaseSaveSucceeded(saved)) {
        try {
          localStorage.setItem(wsDataKey(wsId), JSON.stringify(removed.data));
          localStorage.setItem(wsSavedAtKey(wsId), saved.updated_at || new Date().toISOString());
        } catch {}
        return true;
      }
      if (saved?.reason !== "stale_revision" || !saved.remote?.workspace) return false;
      remoteRecord = saved.remote;
    }
    return false;
  }

  if (!localData?.pages) return false;
  const removed = removeChecklistItemFromWorkspaceData(localData, pageId, itemId);
  if (!removed.found) return true;
  try {
    localStorage.setItem(wsDataKey(wsId), JSON.stringify(removed.data));
    localStorage.setItem(wsSavedAtKey(wsId), new Date().toISOString());
  } catch {}
  return true;
}

// Streak: consecutive days (ending today/yesterday) with ≥1 task completed.
function computeStreak(tasks) {
  const doneDays = new Set(
    Object.values(tasks).filter((t) => t.completedAt).map((t) => t.completedAt.slice(0, 10))
  );
  let streak = 0;
  let cursor = todayKey();
  if (!doneDays.has(cursor)) cursor = addDays(cursor, -1);
  while (doneDays.has(cursor) && streak < 730) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

// One-time migration from the old 3-priority/Later model.
function migrateLegacy(tasks) {
  if (readJson(LS_MIGRATED, false)) return tasks;
  const next = { ...tasks };
  const later = readJson(LS_LATER, {}) || {};
  Object.values(later).forEach((l) => {
    if (!l?.text) return;
    const t = makeTask({ title: l.text, createdAt: l.createdAt || new Date().toISOString() });
    next[t.id] = t;
  });
  const days = readJson(LS_DAYS, {}) || {};
  const todayRec = days[todayKey()];
  (todayRec?.priorities || []).forEach((p) => {
    if (!p?.text) return;
    const t = makeTask({
      title: p.text,
      pinnedDate: todayKey(),
      status: p.done ? "done" : "todo",
      completedAt: p.done ? (p.doneAt || new Date().toISOString()) : null,
      priority: p.rank === 1 ? "high" : "medium",
    });
    next[t.id] = t;
  });
  writeJson(LS_MIGRATED, true);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI pieces — every action button carries data-tooltip so the host app's
// styled #wn-tooltip engine explains it on hover.
// ─────────────────────────────────────────────────────────────────────────────

function ProgressRing({ done, total }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const R = 15, C = 2 * Math.PI * R;
  return (
    <span className="fx-ring" data-tooltip={`${done} of ${total} tasks done today — finish the ring!`}>
      <svg viewBox="0 0 38 38" width="38" height="38">
        <circle cx="19" cy="19" r={R} fill="none" stroke="var(--line-strong)" strokeWidth="3.4" />
        <circle
          cx="19" cy="19" r={R} fill="none" stroke="var(--accent)" strokeWidth="3.4"
          strokeLinecap="round" strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          transform="rotate(-90 19 19)"
          className="fx-ring-arc"
          style={{ transition: "stroke-dashoffset .35s ease" }}
        />
      </svg>
      <span className="fx-ring-label">{done}/{total}</span>
    </span>
  );
}

function QuickAdd({ onAdd, workspaces = [] }) {
  const [value, setValue] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const parsed = useMemo(() => parseQuickAdd(value), [value]);
  const submit = () => {
    if (!parsed.title) return;
    onAdd({ ...parsed, workspaceId });
    setValue("");
    setWorkspaceId("");
  };
  return (
    <div className="fx-quickadd">
      <span className="fx-quickadd-plus">+</span>
      <input
        value={value}
        placeholder="Add a task…   try:  ship the deck !high tomorrow"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        data-tooltip="Type a task. Tokens: !high / !med / !low set priority · today, tomorrow, fri or 2026-06-20 set the due date"
      />
      <span className="fx-quickadd-chips">
        {value.trim() && parsed.hadPriority && <span className={`fx-pill fx-pill-${parsed.priority}`}>{parsed.priority}</span>}
        {value.trim() && parsed.dueDate && <span className="fx-pill fx-pill-due">{shortDate(parsed.dueDate)}</span>}
      </span>
      <select
        className="fx-quickadd-workspace"
        value={workspaceId}
        onChange={(e) => setWorkspaceId(e.target.value)}
        aria-label="Task workspace"
        data-tooltip="Choose which workspace this task belongs to. Leave as Personal for a private Focus task."
      >
        <option value="">Personal</option>
        {(workspaces || []).filter((ws) => ws?.id).map((ws) => (
          <option key={ws.id} value={ws.id}>{ws.name || ws.id}</option>
        ))}
      </select>
      <button className="fx-quickadd-go" onClick={submit} disabled={!parsed.title} data-tooltip="Add this task (or press Enter)">Add</button>
    </div>
  );
}

const NEXT_PRIORITY = { high: "medium", medium: "low", low: "high" };

function TaskRow({ task, today, onPatch, onDelete, onPin, onOpenSource, big = false, selectable = false, selected = false, onSelect }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef(null);
  const dateInputRef = useRef(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const overdue = task.status !== "done" && task.dueDate && task.dueDate < today;
  const dueToday = task.dueDate === today;
  const done = task.status === "done";

  const toggleDone = () => {
    if (!done) {
      setLeaving(true);
      setTimeout(() => {
        setLeaving(false);
        onPatch(task.id, { status: "done", completedAt: new Date().toISOString() });
      }, 240);
    } else {
      onPatch(task.id, { status: "todo", completedAt: null });
    }
  };
  const commitTitle = () => {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== task.title) onPatch(task.id, { title: t });
    else setDraft(task.title);
  };
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.focus({ preventScroll: true });
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch {
      input.click();
    }
  };

  return (
    <div className={`fx-task${big ? " fx-task-big" : ""}${done ? " fx-task-done" : ""}${leaving ? " fx-task-leaving" : ""}`}>
      {selectable && (
        <label className="fx-task-select" data-tooltip={selected ? "Remove from selection" : "Select this task"}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(task.id, e.target.checked)}
            aria-label={`Select ${task.title}`}
          />
        </label>
      )}
      <button
        className={`fx-check${done ? " fx-on" : ""}`}
        onClick={toggleDone}
        data-tooltip={done ? "Mark not done — moves it back to its bucket" : "Mark done — also checks the source to-do in your workspace"}
      >✓</button>
      <div className="fx-task-main">
        {editing ? (
          <input
            ref={inputRef}
            className="fx-task-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") { setDraft(task.title); setEditing(false); }
            }}
          />
        ) : (
          <span className="fx-task-title" onClick={() => { setDraft(task.title); setEditing(true); }} data-tooltip="Click to rename this task">{task.title}</span>
        )}
      </div>
      {/* Meta on the RIGHT so dates line up vertically and compare at a glance:
          workspace · priority · date (date rightmost). */}
      <span className="fx-task-meta">
        {task.sourceType === "document" && task.sourceLabel && (
          <button className="fx-task-src" onClick={() => onOpenSource?.(task)} data-tooltip={`Open the source page: ${task.sourceLabel}`}>📄 {sourceWsLabel(task.sourceLabel)}</button>
        )}
        <button
          className={`fx-pill fx-pill-${task.priority}`}
          onClick={() => onPatch(task.id, { priority: NEXT_PRIORITY[task.priority] || "medium" })}
          data-tooltip="Click to cycle priority: high → medium → low"
        >{task.priority}</button>
        <span className="fx-date-control">
          <button
            className={`fx-pill fx-pill-due${overdue ? " fx-overdue" : ""}${dueToday ? " fx-today" : ""}`}
            onClick={openDatePicker}
            data-tooltip="Open the calendar and choose a due date"
            aria-label={task.dueDate ? `Change due date, currently ${shortDate(task.dueDate)}` : "Set due date"}
            type="button"
          >
            <span className="fx-date-icon" aria-hidden="true">▣</span>
            {task.dueDate ? shortDate(task.dueDate) : "Set date"}
          </button>
          <input
            ref={dateInputRef}
            className="fx-date-native"
            type="date"
            value={task.dueDate || ""}
            onChange={(e) => onPatch(task.id, { dueDate: e.target.value })}
            tabIndex="-1"
            aria-hidden="true"
          />
        </span>
      </span>
      <span className="fx-task-actions">
        {!done && (
          <React.Fragment>
            <button className="fx-mini" data-tooltip="Snooze — push the due date to tomorrow" onClick={() => onPatch(task.id, { dueDate: addDays(today, 1), status: task.status === "waiting" ? "todo" : task.status })}>⤳</button>
            {task.status !== "waiting"
              ? <button className="fx-mini" data-tooltip="Put on hold — paused or blocked" onClick={() => onPatch(task.id, { status: "waiting" })}>⏳</button>
              : <button className="fx-mini" data-tooltip="Take off hold — move back to your list" onClick={() => onPatch(task.id, { status: "todo" })}>▶</button>}
            <button
              className={`fx-mini${task.pinnedDate === today ? " fx-pin-on" : ""}`}
              data-tooltip={task.pinnedDate === today ? "Unpin from Today's Priorities" : "Pin to Today's Priorities — your top 3 for the day"}
              onClick={() => onPin(task.id)}
            >{task.pinnedDate === today ? "★" : "☆"}</button>
          </React.Fragment>
        )}
        <button className="fx-mini fx-mini-del" data-tooltip={task.sourceType === "document" ? "Delete this task and its workspace to-do" : "Delete this Focus task"} onClick={() => onDelete(task.id)}>×</button>
      </span>
    </div>
  );
}

const BUCKET_META = {
  overdue:  { title: "Overdue",   cls: "fx-b-overdue",  sub: "Past due — clear these or move the date.", empty: "Nothing overdue. Clean slate." },
  today:    { title: "Due Today", cls: "fx-b-today",    sub: "Due today, based on the date.", empty: "Nothing due today. Pin something or pull one in." },
  upcoming: { title: "Upcoming",  cls: "fx-b-upcoming", sub: "Coming up — next 7 days and beyond.", empty: "Nothing scheduled ahead yet." },
  nodate:   { title: "No date",   cls: "fx-b-nodate",   sub: "Tasks without a due date.", empty: "Everything here has a date." },
  waiting:  { title: "On Hold",   cls: "fx-b-hold",     sub: "Paused or blocked on someone else.", empty: "Nothing on hold." },
};

function Bucket({ id, tasks, today, onPatch, onDelete, onPin, onOpenSource, showEmpty = id === "today", selectable = false, selectedIds = new Set(), onSelectTask }) {
  const meta = BUCKET_META[id];
  // Don't render big empty boxes for the quiet buckets — only Due Today keeps a
  // guiding empty state, the rest collapse to nothing when empty.
  if (!tasks.length && !showEmpty) return null;
  return (
    <section className={`fx-bucket ${meta.cls} fx-fade`}>
      <div className="fx-bucket-head">
        <h2>{meta.title} {tasks.length > 0 && <span className="fx-count">{tasks.length}</span>}</h2>
        <span className="fx-bucket-sub">{meta.sub}</span>
      </div>
      {tasks.length === 0
        ? <div className="fx-empty">{meta.empty}</div>
        : tasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} selectable={selectable} selected={selectedIds.has(t.id)} onSelect={onSelectTask} />
          ))}
    </section>
  );
}

function DoneSection({ tasks, today, onPatch, onDelete, onPin, onOpenSource, sub = "all completed tasks" }) {
  const [open, setOpen] = useState(false);
  if (!tasks.length) return null;
  return (
    <section className="fx-bucket fx-b-done fx-fade">
      <button className="fx-done-toggle" onClick={() => setOpen(!open)} data-tooltip={open ? "Collapse completed tasks" : "Show completed tasks"}>
        <span className={`fx-done-chev${open ? " fx-open" : ""}`}>▸</span>
        Done <span className="fx-count">{tasks.length}</span>
        <span className="fx-bucket-sub" style={{ marginLeft: 8 }}>{sub}</span>
      </button>
      {open && tasks.map((t) => (
        <TaskRow key={t.id} task={t} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} />
      ))}
    </section>
  );
}

function UpcomingByDate({ tasks, today, onPatch, onDelete, onPin, onOpenSource, selectable = false, selectedIds = new Set(), onSelectTask }) {
  if (!tasks.length) return null;
  const byDate = tasks.reduce((groups, task) => {
    const key = task.dueDate || "No date";
    (groups[key] = groups[key] || []).push(task);
    return groups;
  }, {});
  return (
    <section className="fx-bucket fx-b-upcoming fx-fade">
      <div className="fx-bucket-head">
        <h2>Upcoming <span className="fx-count">{tasks.length}</span></h2>
        <span className="fx-bucket-sub">Next up, arranged by due date.</span>
      </div>
      <div className="fx-date-groups">
        {Object.keys(byDate).sort().map((date) => (
          <div className="fx-date-group" key={date}>
            <div className="fx-date-group-label">{shortDate(date)}</div>
            {byDate[date].sort(taskOrder).map((task) => (
              <TaskRow key={task.id} task={task} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} selectable={selectable} selected={selectedIds.has(task.id)} onSelect={onSelectTask} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkspaceTaskGroup({ group, today, onPatch, onDelete, onPin, onOpenSource, doneOnly = false, selectedIds = new Set(), onSelectTask, onSelectAll, onDeleteSelected }) {
  const buckets = { overdue: [], today: [], upcoming: [], nodate: [], waiting: [], done: [] };
  group.tasks.forEach((task) => buckets[bucketOf(task, today)]?.push(task));
  ["overdue", "today", "upcoming", "nodate", "waiting"].forEach((key) => buckets[key].sort(taskOrder));
  buckets.done.sort((a, b) => String(b.completedAt || b.updatedAt || "").localeCompare(String(a.completedAt || a.updatedAt || "")));
  const openCount = group.tasks.length - buckets.done.length;
  const selectedCount = group.tasks.filter((task) => selectedIds.has(task.id)).length;
  const allSelected = group.tasks.length > 0 && selectedCount === group.tasks.length;
  return (
    <section className="fx-workspace-tasks fx-fade">
      <div className="fx-workspace-tasks-head">
        <span className="fx-workspace-tasks-icon">{(group.name || "W").trim().charAt(0).toUpperCase()}</span>
        <span className="fx-workspace-tasks-title">
          <strong>{group.name}</strong>
          <small>{doneOnly ? `${group.tasks.length} completed` : `${openCount} open`}</small>
        </span>
        <span className="fx-workspace-task-tools">
          <label className="fx-select-all" data-tooltip={allSelected ? "Clear this workspace group selection" : "Select every task in this workspace group"}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onSelectAll?.(group.id, group.tasks.map((task) => task.id), e.target.checked)}
              aria-label={`Select all tasks in ${group.name}`}
            />
            Select all
          </label>
          <button
            className="fx-bulk-delete"
            type="button"
            disabled={selectedCount === 0}
            onClick={() => onDeleteSelected?.(group.id)}
            data-tooltip={selectedCount ? `Delete ${selectedCount} selected task${selectedCount === 1 ? "" : "s"} from this group` : "Select tasks in this group first"}
          >
            Delete selected{selectedCount ? ` (${selectedCount})` : ""}
          </button>
        </span>
      </div>
      <div className="fx-workspace-tasks-body">
        {doneOnly ? (
          [...group.tasks]
            .sort((a, b) => String(b.completedAt || b.updatedAt || "").localeCompare(String(a.completedAt || a.updatedAt || "")))
            .map((task) => <TaskRow key={task.id} task={task} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} selectable selected={selectedIds.has(task.id)} onSelect={onSelectTask} />)
        ) : (
          <React.Fragment>
            <Bucket id="overdue" tasks={buckets.overdue} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} showEmpty={false} selectable selectedIds={selectedIds} onSelectTask={onSelectTask} />
            <Bucket id="today" tasks={buckets.today} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} showEmpty={false} selectable selectedIds={selectedIds} onSelectTask={onSelectTask} />
            <UpcomingByDate tasks={buckets.upcoming} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} selectable selectedIds={selectedIds} onSelectTask={onSelectTask} />
            <Bucket id="nodate" tasks={buckets.nodate} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} showEmpty={false} selectable selectedIds={selectedIds} onSelectTask={onSelectTask} />
            <Bucket id="waiting" tasks={buckets.waiting} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} showEmpty={false} selectable selectedIds={selectedIds} onSelectTask={onSelectTask} />
          </React.Fragment>
        )}
      </div>
    </section>
  );
}

function MiniCalendar({ tasks, events, today, weekDone }) {
  const [monthKey, setMonthKey] = useState(today.slice(0, 7));
  useEffect(() => { setMonthKey(today.slice(0, 7)); }, [today]);
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const dots = useMemo(() => {
    const map = {};
    Object.values(tasks).forEach((t) => {
      if (t.dueDate && t.status !== "done") (map[t.dueDate] = map[t.dueDate] || { due: 0, ev: 0 }).due += 1;
    });
    (events || []).forEach((e) => {
      (map[e.date] = map[e.date] || { due: 0, ev: 0 }).ev += 1;
    });
    return map;
  }, [tasks, events]);
  const shift = (d) => {
    const dt = new Date(y, m - 1 + d, 1);
    setMonthKey(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div className="fx-card">
      <div className="fx-cal-head">
        <button className="fx-mini" onClick={() => shift(-1)} data-tooltip="Previous month">‹</button>
        <span>{monthLabel}</span>
        <button className="fx-mini" onClick={() => shift(1)} data-tooltip="Next month">›</button>
      </div>
      <div className="fx-cal-grid">
        {["S","M","T","W","T","F","S"].map((d, i) => <span key={`h${i}`} className="fx-cal-dow">{d}</span>)}
        {Array.from({ length: startPad }).map((_, i) => <span key={`p${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const key = `${monthKey}-${String(i + 1).padStart(2, "0")}`;
          const d = dots[key];
          return (
            <span
              key={key}
              className={`fx-cal-day${key === today ? " fx-cal-today" : ""}`}
              data-tooltip={d ? `${shortDate(key)}: ${d.due ? `${d.due} due` : ""}${d.due && d.ev ? " · " : ""}${d.ev ? `${d.ev} event${d.ev > 1 ? "s" : ""}` : ""}` : undefined}
            >
              {i + 1}
              <span className="fx-cal-dots">
                {d?.due ? <i className="fx-dot fx-dot-due" /> : null}
                {d?.ev ? <i className="fx-dot fx-dot-ev" /> : null}
              </span>
            </span>
          );
        })}
      </div>
      {typeof weekDone === "number" && (
        <div className="fx-cal-foot">
          <span className="fx-cal-foot-num">{weekDone}</span>
          <span>task{weekDone === 1 ? "" : "s"} done this week</span>
        </div>
      )}
    </div>
  );
}

function Upcoming({ tasks, events, today }) {
  const horizon = addDays(today, 7);
  const rows = useMemo(() => {
    const out = [];
    Object.values(tasks).forEach((t) => {
      if (t.status !== "done" && t.dueDate && t.dueDate >= today && t.dueDate <= horizon) {
        out.push({ key: `t${t.id}`, date: t.dueDate, label: t.title, kind: "due" });
      }
    });
    (events || []).forEach((e) => {
      if (e.date >= today && e.date <= horizon) {
        out.push({ key: `e${e.id}`, date: e.date, label: e.title, kind: "event", time: e.time || "" });
      }
    });
    return out.sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`)).slice(0, 8);
  }, [tasks, events, today]);
  return (
    <div className="fx-card">
      <div className="fx-card-h">Upcoming 7 days</div>
      {rows.length === 0 && <div className="fx-empty">Quiet week ahead. Add due dates or calendar events.</div>}
      {rows.map((r) => (
        <div key={r.key} className="fx-up-row">
          <span className={`fx-dot ${r.kind === "event" ? "fx-dot-ev" : "fx-dot-due"}`} />
          <span className="fx-up-date">{shortDate(r.date)}{r.time ? ` ${r.time}` : ""}</span>
          <span className="fx-up-label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function WorkspacePull({ suggestions, existingSourceIds, onImport }) {
  const deletedSources = readFocusDeleteTombstones().sourceIds || {};
  const fresh = suggestions.filter((s) => !existingSourceIds.has(s.sourceId) && !deletedSources[s.sourceId]);
  return (
    <div className="fx-card">
      <div className="fx-card-h">From your workspace</div>
      {fresh.length === 0 && <div className="fx-empty">No open checklist items found in your WAULT pages.</div>}
      {fresh.slice(0, 8).map((s) => (
        <button key={s.sourceId} className="fx-pull-row" onClick={() => onImport(s)} data-tooltip={`Import this to-do from "${s.pageTitle}" — completing it here also checks it there`}>
          <span className="fx-pull-plus">+</span>
          <span className="fx-up-label">{s.title}</span>
          {s.dueDate && <span className="fx-pill fx-pill-due">{shortDate(s.dueDate)}</span>}
          <span className="fx-pull-src">{s.pageTitle}</span>
        </button>
      ))}
    </div>
  );
}

// ── Workspace cards: the homepage's door into every workspace ───────────────
function WorkspaceCards({ workspaces, activeWorkspaceId, data, onOpen }) {
  const cards = (workspaces || []).map((ws) => {
    let pageCount = null;
    if (ws.id === activeWorkspaceId) {
      pageCount = Object.values(data?.pages || {}).filter((p) => !p.system).length;
    } else {
      const cached = readJson(wsDataKey(ws.id), null);
      if (cached?.pages) pageCount = Object.values(cached.pages).filter((p) => !p.system).length;
    }
    return { ...ws, pageCount };
  });
  if (!cards.length) return null;
  return (
    <section className="fx-ws fx-fade">
      <div className="fx-ws-head">
        <h2>Workspaces</h2>
        <span className="fx-bucket-sub">Jump back into your work.</span>
      </div>
      <div className="fx-ws-grid">
        {cards.map((ws) => {
          const active = ws.id === activeWorkspaceId;
          return (
            <button
              key={ws.id}
              className={`fx-ws-card${active ? " fx-ws-active" : ""}`}
              onClick={() => onOpen(ws, active)}
              data-tooltip={active ? `Open ${ws.name || "this workspace"} — you're currently in it` : `Switch to ${ws.name || ws.id}`}
            >
              <span className="fx-ws-icon">{(ws.name || "W").trim().charAt(0).toUpperCase()}</span>
              <span className="fx-ws-meta">
                <span className="fx-ws-name">{ws.name || ws.id}</span>
                <span className="fx-ws-sub">
                  {ws.pageCount != null ? `${ws.pageCount} page${ws.pageCount === 1 ? "" : "s"}` : "synced"}
                  {ws.updatedAt ? ` · ${agoLabel(ws.updatedAt)}` : ""}
                </span>
              </span>
              {active && <span className="fx-ws-badge">Current</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FocusHome — the page component the main app mounts for HOME_PAGE_ID.
// ─────────────────────────────────────────────────────────────────────────────
function FocusHome({ data, activeWorkspaceId, workspaces, deletedWorkspaceIds = [], authUser, switchWorkspace, setCurrentPage, completeChecklistItem, deleteChecklistItem, cloudConnected }) {
  const [today, setToday] = useState(todayKey());
  const [tasks, setTasks] = useState(() => migrateLegacy(readJson(LS_TASKS, {})));
  const [groupSelections, setGroupSelections] = useState({});
  const [otherSuggestions, setOtherSuggestions] = useState([]); // non-active workspaces
  const [otherEvents, setOtherEvents] = useState([]);
  const [focusSaveState, setFocusSaveState] = useState("saved");

  const fbRef = useRef(null);
  const uidRef = useRef(null);
  const focusWritesInFlightRef = useRef(0);
  const focusWriteFailedRef = useRef(false);
  const otherChecklistSnapshotRef = useRef(new Map());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const localOnly = !cloudConnected || !authUser;
  const deletedWorkspaceKey = (deletedWorkspaceIds || []).filter(Boolean).sort().join("|");
  const trackFocusCloudWrite = useCallback((promise) => {
    if (!fbRef.current || !uidRef.current) return Promise.resolve(promise);
    if (focusWritesInFlightRef.current === 0) focusWriteFailedRef.current = false;
    focusWritesInFlightRef.current += 1;
    setFocusSaveState("saving");
    return Promise.resolve(promise).then((ok) => {
      if (!ok) focusWriteFailedRef.current = true;
      focusWritesInFlightRef.current = Math.max(0, focusWritesInFlightRef.current - 1);
      setFocusSaveState(focusWritesInFlightRef.current > 0 ? "saving" : focusWriteFailedRef.current ? "failed" : "saved");
      return ok;
    }).catch(() => {
      focusWriteFailedRef.current = true;
      focusWritesInFlightRef.current = Math.max(0, focusWritesInFlightRef.current - 1);
      setFocusSaveState(focusWritesInFlightRef.current > 0 ? "saving" : "failed");
      return false;
    });
  }, []);

  useEffect(() => {
    const refresh = () => setToday(todayKey());
    document.addEventListener("visibilitychange", refresh);
    const t = setInterval(refresh, 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", refresh); clearInterval(t); };
  }, []);

  // Cloud boot: merge cloud tasks + live subscription. The host app already ran
  // the auth gates, so authUser is trustworthy here. CRITICAL vs the old
  // standalone page: capture the onValue unsubscribe and clean it up — Home
  // mounts/unmounts on every navigation.
  useEffect(() => {
    const fb = window.WorkspaceFirebaseSync;
    const uid = authUser?.uid;
    if (!fb || !uid || !fb.onValue || !fb.ref || !fb.database) return undefined;
    fbRef.current = fb;
    uidRef.current = uid;
    let cancelled = false;
    let unsub = null;
    (async () => {
      const cloud = await cloudLoadTasks(fb, uid);
      if (cancelled) return;
      if (cloud) {
        setTasks((local) => {
          const merged = mergeTaskMaps(local, cloud);
          writeJson(LS_TASKS, merged);
          // Push local-only tasks up so both sides converge.
          Object.values(merged).forEach((t) => {
            if (!cloud[t.id] && !isDeletedFocusTask(t)) cloudSaveTask(fb, uid, t);
          });
          return merged;
        });
      }
      const pendingDeletes = Object.keys(readFocusDeleteTombstones().taskIds || {});
      if (pendingDeletes.length) {
        setFocusSaveState("saving");
        const results = await Promise.all(pendingDeletes.map((taskId) => cloudDeleteTask(fb, uid, taskId)));
        if (!cancelled) setFocusSaveState(results.every(Boolean) ? "saved" : "failed");
      }
      if (cancelled) return;
      try {
        unsub = fb.onValue(fb.ref(fb.database, `focus/${uid}/tasks`), (snap) => {
          const val = snap.exists() ? (snap.val() || {}) : {};
          setTasks((prev) => {
            let changed = false;
            const next = { ...prev };
            const tombstones = readFocusDeleteTombstones();
            Object.entries(val).forEach(([id, t]) => {
              if (t?.saveId === SESSION_ID) return;
              if (isDeletedFocusTask({ ...t, id: t?.id || id }, tombstones)) return;
              const cur = next[id];
              if (!cur || String(t?.updatedAt || "") > String(cur.updatedAt || "")) { next[id] = t; changed = true; }
            });
            Object.keys(next).forEach((id) => {
              if (isDeletedFocusTask({ ...next[id], id: next[id]?.id || id }, tombstones)) {
                delete next[id];
                changed = true;
                return;
              }
              // Deleted remotely — drop it, unless this session created it
              // (a stale snapshot must never eat a just-added task).
              if (!val[id] && next[id]?.saveId && next[id].saveId !== SESSION_ID) {
                delete next[id];
                changed = true;
              }
            });
            if (!changed) return prev;
            writeJson(LS_TASKS, next);
            return next;
          });
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (typeof unsub === "function") { try { unsub(); } catch {} }
    };
  }, [authUser?.uid]);

  useEffect(() => {
    if (!deletedWorkspaceKey) return;
    const ids = deletedWorkspaceKey.split("|").filter(Boolean);
    let removed = [];
    ids.forEach((workspaceId) => {
      removed = [...removed, ...cleanupFocusTasksForWorkspace(workspaceId, { fb: fbRef.current, uid: uidRef.current })];
    });
    if (!removed.length) return;
    const removedSet = new Set(removed);
    setTasks((prev) => {
      const next = { ...prev };
      removedSet.forEach((id) => delete next[id]);
      writeJson(LS_TASKS, next);
      return next;
    });
    setGroupSelections((prev) => {
      const next = {};
      Object.entries(prev).forEach(([groupId, idsForGroup]) => {
        const kept = (idsForGroup || []).filter((id) => !removedSet.has(id));
        if (kept.length) next[groupId] = kept;
      });
      return next;
    });
  }, [deletedWorkspaceKey]);

  // Suggestions + events from the ACTIVE workspace come from the live data prop
  // (instant), other workspaces from their localStorage caches (scan on mount).
  const activeWsName = useMemo(
    () => (workspaces || []).find((w) => w.id === activeWorkspaceId)?.name || "This workspace",
    [workspaces, activeWorkspaceId]
  );
  const workspaceSubscriptionKey = (workspaces || [])
    .filter((workspace) => workspace?.id)
    .map((workspace) => `${workspace.id}:${workspace.name || ""}`)
    .sort()
    .join("|");
  const activeSuggestions = useMemo(() => {
    const out = [];
    scanWorkspaceData(activeWorkspaceId, activeWsName, data, new Set(), out);
    out.sort((a, b) => (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1);
    return out;
  }, [data, activeWorkspaceId, activeWsName]);

  useEffect(() => {
    const others = (workspaces || []).filter((workspace) => workspace?.id && workspace.id !== activeWorkspaceId);
    const workspaceData = new Map();
    const unsubscribers = [];
    let cancelled = false;

    const publish = () => {
      if (cancelled) return;
      const suggestions = [];
      const seen = new Set();
      const events = [];
      others.forEach((workspace) => {
        const otherData = workspaceData.get(workspace.id);
        if (!otherData?.pages) return;
        scanWorkspaceData(workspace.id, workspace.name, otherData, seen, suggestions);
        Object.values(otherData.events || {}).forEach((event) => {
          if (event?.date && event?.title) events.push({ ...event, wsName: workspace.name || workspace.id });
        });
      });
      setOtherSuggestions(suggestions);
      setOtherEvents(events);
    };

    const reconcileRemovedSources = (workspaceId, otherData) => {
      const liveState = workspaceChecklistState(workspaceId, otherData);
      const previousState = otherChecklistSnapshotRef.current.get(workspaceId) || null;
      const workspaceTasks = Object.values(tasksRef.current).filter((task) => (
        task?.sourceType === "document" &&
        String(task.sourceId || "").startsWith(`${workspaceId}:`)
      ));
      const removedTasks = workspaceTasks.filter((task) => !liveState.has(task.sourceId));
      const removedIds = removedTasks.length
        ? cleanupFocusTasksForSources(removedTasks.map((task) => task.sourceId), { fb: fbRef.current, uid: uidRef.current })
        : [];
      const removedSet = new Set(removedIds);
      const completionUpdates = workspaceTasks.filter((task) => {
        if (removedSet.has(task.id) || !liveState.has(task.sourceId)) return false;
        const done = liveState.get(task.sourceId);
        if (!previousState) return done === true && task.status !== "done";
        return previousState.has(task.sourceId) && previousState.get(task.sourceId) !== done && (task.status === "done") !== done;
      }).map((task) => stamped({
        ...task,
        status: liveState.get(task.sourceId) ? "done" : "todo",
        completedAt: liveState.get(task.sourceId) ? (task.completedAt || new Date().toISOString()) : null,
      }));
      otherChecklistSnapshotRef.current.set(workspaceId, liveState);
      if (!removedIds.length && !completionUpdates.length) return;

      const next = { ...tasksRef.current };
      removedSet.forEach((id) => delete next[id]);
      completionUpdates.forEach((task) => { next[task.id] = task; });
      tasksRef.current = next;
      writeJson(LS_TASKS, next);
      setTasks(next);
      completionUpdates.forEach((task) => {
        trackFocusCloudWrite(cloudSaveTask(fbRef.current, uidRef.current, task));
      });
    };

    others.forEach((workspace) => {
      const cached = readJson(wsDataKey(workspace.id), null);
      if (cached?.pages) workspaceData.set(workspace.id, cached);
    });
    publish();

    const fb = fbRef.current || window.WorkspaceFirebaseSync;
    if (authUser?.uid && fb?.onWorkspaceUpdate) {
      others.forEach((workspace) => {
        const unsubscribe = fb.onWorkspaceUpdate(workspace.id, (record) => {
          if (cancelled || !record?.workspace?.pages) return;
          workspaceData.set(workspace.id, record.workspace);
          try {
            localStorage.setItem(wsDataKey(workspace.id), JSON.stringify(record.workspace));
            localStorage.setItem(wsSavedAtKey(workspace.id), record.updated_at || new Date().toISOString());
          } catch {}
          reconcileRemovedSources(workspace.id, record.workspace);
          publish();
        });
        if (typeof unsubscribe === "function") unsubscribers.push(unsubscribe);
      });
    }

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => { try { unsubscribe(); } catch {} });
    };
  }, [workspaceSubscriptionKey, activeWorkspaceId, authUser?.uid, trackFocusCloudWrite]);

  const suggestions = useMemo(() => {
    const seen = new Set(activeSuggestions.map((s) => s.title.toLowerCase()));
    const merged = [...activeSuggestions];
    otherSuggestions.forEach((s) => {
      const k = s.title.toLowerCase();
      if (!seen.has(k)) { seen.add(k); merged.push(s); }
    });
    return merged.slice(0, 30);
  }, [activeSuggestions, otherSuggestions]);

  const events = useMemo(() => {
    const out = Object.values(data?.events || {})
      .filter((ev) => ev?.date && ev?.title)
      .map((ev) => ({ ...ev, wsName: activeWsName }));
    return [...out, ...otherEvents].sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
  }, [data, otherEvents, activeWsName]);

  // ── Task mutations ─────────────────────────────────────────────────────────
  const commitTask = useCallback((task) => {
    const t = stamped(task);
    setTasks((prev) => {
      const next = { ...prev, [t.id]: t };
      writeJson(LS_TASKS, next);
      return next;
    });
    trackFocusCloudWrite(cloudSaveTask(fbRef.current, uidRef.current, t));
  }, [trackFocusCloudWrite]);

  const patchTask = useCallback((id, patch) => {
    const cur = tasksRef.current[id];
    if (!cur) return;
    const updated = stamped({ ...cur, ...patch });

    // Focus→Main: imported tasks mirror completion into the source checklist.
    // This side effect must happen OUTSIDE the setTasks updater; calling the
    // host App's setData while React is calculating FocusHome state causes the
    // "update a component while rendering another component" warning.
    if (cur.sourceType === "document" && "status" in patch) {
      const [wsId, pageId, itemId] = String(cur.sourceId).split(":");
      if (wsId && wsId === activeWorkspaceId && typeof completeChecklistItem === "function") {
        completeChecklistItem(pageId, itemId, updated.status === "done");
      } else {
        trackFocusCloudWrite(completeWorkspaceChecklistSource(cur.sourceId, updated.status === "done", {
          fb: fbRef.current,
          workspaces,
        }));
      }
    }

    setTasks((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev, [id]: updated };
      writeJson(LS_TASKS, next);
      return next;
    });
    trackFocusCloudWrite(cloudSaveTask(fbRef.current, uidRef.current, updated));
  }, [activeWorkspaceId, completeChecklistItem, trackFocusCloudWrite, workspaces]);

  const removeFocusTaskRecords = useCallback((tasksToRemove) => {
    const list = (Array.isArray(tasksToRemove) ? tasksToRemove : [tasksToRemove]).filter(Boolean);
    if (!list.length) return;
    const idsToDelete = [...new Set(list.map((task) => task.id).filter(Boolean))];
    if (!idsToDelete.length) return;
    const deleteSet = new Set(idsToDelete);
    rememberDeletedFocusTasks(list);
    setTasks((prev) => {
      const next = { ...prev };
      idsToDelete.forEach((id) => delete next[id]);
      writeJson(LS_TASKS, next);
      return next;
    });
    const taskById = new Map(list.map((task) => [task.id, task]));
    trackFocusCloudWrite(Promise.all(idsToDelete.map((id) => cloudDeleteTask(fbRef.current, uidRef.current, id, taskById.get(id) || null))).then((results) => results.every(Boolean)));
    setGroupSelections((prev) => {
      const next = {};
      Object.entries(prev).forEach(([groupId, idsForGroup]) => {
        const kept = (idsForGroup || []).filter((id) => !deleteSet.has(id));
        if (kept.length) next[groupId] = kept;
      });
      return next;
    });
  }, [trackFocusCloudWrite]);

  const deleteTasks = useCallback(async (ids) => {
    const idsToDelete = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
    if (!idsToDelete.length) return;
    const tasksToDelete = idsToDelete.map((id) => tasksRef.current[id]).filter(Boolean);
    const confirmed = [];
    const failed = [];

    for (const task of tasksToDelete) {
      if (task.sourceType !== "document" || !task.sourceId) {
        confirmed.push(task);
        continue;
      }
      try {
        const ok = await deleteWorkspaceChecklistSource(task.sourceId, {
          activeWorkspaceId,
          deleteChecklistItem,
          fb: fbRef.current,
          workspaces,
        });
        if (ok) confirmed.push(task);
        else failed.push(task);
      } catch (err) {
        console.warn("FocusHome: source checklist delete failed:", err.message);
        failed.push(task);
      }
    }

    if (confirmed.length) removeFocusTaskRecords(confirmed);
    if (failed.length) {
      alert(`Could not delete ${failed.length} linked workspace task${failed.length === 1 ? "" : "s"} from Firebase. Nothing was removed from Focus for those failed item${failed.length === 1 ? "" : "s"}.`);
    }
  }, [activeWorkspaceId, deleteChecklistItem, removeFocusTaskRecords, workspaces]);

  const deleteTask = useCallback((id) => deleteTasks([id]), [deleteTasks]);

  const addTask = useCallback(({ title, priority, dueDate, workspaceId = "" }) => {
    const workspace = (workspaces || []).find((ws) => ws?.id === workspaceId);
    commitTask(makeTask({
      title,
      priority,
      dueDate,
      workspaceId: workspace?.id || "",
      workspaceName: workspace?.name || "",
    }));
  }, [commitTask, workspaces]);

  const importSuggestion = useCallback((s) => {
    commitTask(makeTask({
      title: s.title,
      dueDate: s.dueDate || "",
      sourceType: "document",
      sourceId: s.sourceId,
      sourceLabel: `${s.pageTitle} · ${s.wsName}`,
    }));
  }, [commitTask]);

  // ── Auto-pull: materialise the ACTIVE workspace's open checklist items as Focus
  // tasks so they land in the right date bucket automatically (no manual import).
  // Deduped by sourceId; a persisted "seeded" set means deleting a pulled task
  // won't resurrect it on the next scan.
  useEffect(() => {
    if (!activeWorkspaceId || !activeSuggestions.length) return;
    const seeded = new Set(readJson(LS_SEEDED, []) || []);
    const deletedSources = readFocusDeleteTombstones().sourceIds || {};
    const have = new Set(Object.values(tasksRef.current).map((t) => t && t.sourceId).filter(Boolean));
    const toAdd = activeSuggestions.filter((s) => s.sourceId && !have.has(s.sourceId) && !seeded.has(s.sourceId) && !deletedSources[s.sourceId]);
    if (!toAdd.length) return;
    toAdd.forEach((s) => { importSuggestion(s); seeded.add(s.sourceId); });
    writeJson(LS_SEEDED, [...seeded]);
  }, [activeSuggestions, activeWorkspaceId, importSuggestion]);

  // ── Demo seeder: visit any URL with ?demo=1 to populate Focus with a curated
  // task set spanning every bucket (Overdue / Due Today / Upcoming / No date /
  // On Hold / Done) plus two pinned to Today's Priorities. Seeds once per device
  // (flagged in localStorage) and routes through commitTask, so it cloud-syncs
  // to your account when signed in. The ?demo param is stripped afterward so a
  // reload never re-seeds. Safe to leave in: it does nothing without ?demo.
  useEffect(() => {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch (_) { return; }
    if (!params.has("demo")) return;
    const FLAG = "wault_focus_demo_v1";
    if (!localStorage.getItem(FLAG)) {
      const t = todayKey();
      const nowIso = new Date().toISOString();
      const demo = [
        { title: "Send Q2 investor update",          dueDate: addDays(t, -2), priority: "high",   pinnedDate: t },
        { title: "Reply to vendor contract redlines", dueDate: addDays(t, -1), priority: "medium" },
        { title: "Finalize product launch deck",      dueDate: t,              priority: "high",   pinnedDate: t },
        { title: "Post standup notes to the team",    dueDate: t,              priority: "low" },
        { title: "Prep onboarding for new hire",      dueDate: addDays(t, 2),  priority: "medium" },
        { title: "Quarterly metrics review",          dueDate: addDays(t, 6),  priority: "medium" },
        { title: "Brainstorm Q3 campaign ideas",      dueDate: "",             priority: "medium" },
        { title: "Refactor the auth flow",            dueDate: "",             priority: "low" },
        { title: "Waiting on legal sign-off",         dueDate: "",             priority: "medium", status: "waiting" },
        { title: "Blocked: partner API access",       dueDate: "",             priority: "high",   status: "waiting" },
        { title: "Ship mobile-friendly update",       dueDate: addDays(t, -1), priority: "high",   status: "done", completedAt: nowIso },
        { title: "Set up team MCP server",            dueDate: addDays(t, -3), priority: "medium", status: "done", completedAt: nowIso },
      ];
      demo.forEach((d) => commitTask(makeTask(d)));
      try { localStorage.setItem(FLAG, "1"); } catch (_) {}
    }
    // Strip ?demo (keep any other params/hash) so reloads don't re-trigger.
    params.delete("demo");
    const qs = params.toString();
    try {
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
    } catch (_) {}
  }, [commitTask]);

  const pinTask = useCallback((id) => {
    const prev = tasksRef.current;
    const cur = prev[id];
    if (!cur) return;
    const pinnedNow = Object.values(prev).filter((task) => task.pinnedDate === todayKey() && task.status !== "done");
    const isPinned = cur.pinnedDate === todayKey();
    if (!isPinned && pinnedNow.length >= 3) return;
    if (isPinned) {
      const seed = readJson(LS_PINSEED, null);
      const day = todayKey();
      const base = (seed && seed.date === day) ? seed : { date: day, userUnpinned: [] };
      if (!base.userUnpinned.includes(id)) base.userUnpinned.push(id);
      writeJson(LS_PINSEED, base);
    }
    const updated = stamped({ ...cur, pinnedDate: isPinned ? "" : todayKey() });
    const next = { ...prev, [id]: updated };
    tasksRef.current = next;
    writeJson(LS_TASKS, next);
    setTasks(next);
    trackFocusCloudWrite(cloudSaveTask(fbRef.current, uidRef.current, updated));
  }, [trackFocusCloudWrite]);

  // Open the page a document-task came from. Active workspace → navigate
  // directly; another workspace → switch first, then jump to the page.
  const openSource = useCallback((task) => {
    const [wsId, pageId] = String(task.sourceId || "").split(":");
    if (!wsId || !pageId) return;
    if (wsId === activeWorkspaceId) {
      setCurrentPage?.(pageId);
    } else if (typeof switchWorkspace === "function") {
      Promise.resolve(switchWorkspace(wsId)).then(() => setCurrentPage?.(pageId)).catch(() => {});
    }
  }, [activeWorkspaceId, setCurrentPage, switchWorkspace]);

  const openWorkspace = useCallback((ws, isActive) => {
    if (isActive) {
      const firstRoot = (data?.rootOrder || []).find((id) => data?.pages?.[id] && !data.pages[id].system);
      if (firstRoot) setCurrentPage?.(firstRoot);
    } else if (typeof switchWorkspace === "function") {
      switchWorkspace(ws.id);
    }
  }, [data, setCurrentPage, switchWorkspace]);

  // ── Main→Focus reconcile (the other half of the bidirectional sync) ────────
  // Watches the live workspace data and flips linked tasks when their source
  // checklist item changes IN THE EDITOR. Loop-safe by construction:
  //  - deps are [data, activeWorkspaceId] only; task changes can't re-trigger it
  //  - live mode reacts only to observed TRANSITIONS (prev→cur done flips)
  //  - silentPatch never writes back into workspace data
  // The previous-state snapshot lives at MODULE level (lastDoneMap) so it
  // survives Home unmounting — checklist edits happen in the editor while Home
  // is away, and the flip (including un-completing) lands on the next visit.
  useEffect(() => {
    const cur = new Map();
    Object.values(data?.pages || {}).forEach((p) => {
      (p?.blocks || []).forEach((b) => {
        if (b?.type !== "checklist" || !Array.isArray(b.items)) return;
        b.items.forEach((it) => { if (it?.id) cur.set(`${activeWorkspaceId}:${p.id}:${it.id}`, !!it.done); });
      });
    });

    const silentPatch = (task, done) => {
      const updated = stamped({
        ...task,
        status: done ? "done" : "todo",
        completedAt: done ? (task.completedAt || new Date().toISOString()) : null,
      });
      setTasks((prev) => {
        if (!prev[task.id]) return prev;
        const next = { ...prev, [task.id]: updated };
        writeJson(LS_TASKS, next);
        return next;
      });
      trackFocusCloudWrite(cloudSaveTask(fbRef.current, uidRef.current, updated));
    };

    const workspaceDataAvailable = !!(activeWorkspaceId && data?.pages && !data.pages.cloud_workspace_unavailable);
    const docTasks = Object.values(tasksRef.current).filter((t) => t?.sourceType === "document" && t.sourceId);
    const missingSourceTasks = workspaceDataAvailable
      ? docTasks.filter((t) => {
          const { wsId } = parseSourceId(t.sourceId);
          return wsId === activeWorkspaceId && !cur.has(t.sourceId);
        })
      : [];
    if (missingSourceTasks.length) removeFocusTaskRecords(missingSourceTasks);

    const prev = lastDoneMap;

    if (!prev || prev.wsId !== activeWorkspaceId) {
      // Baseline (mount or workspace switch): completions are sticky — propagate
      // done=true from checklist to task, never un-complete from a baseline.
      docTasks.filter((t) => !missingSourceTasks.some((missing) => missing.id === t.id)).forEach((t) => {
        if (cur.get(t.sourceId) === true && t.status !== "done") silentPatch(t, true);
      });
    } else {
      // Live: only observed transitions count.
      cur.forEach((done, sid) => {
        if (!prev.map.has(sid) || prev.map.get(sid) === done) return;
        const t = docTasks.find((x) => x.sourceId === sid);
        if (t && (t.status === "done") !== done) silentPatch(t, done);
      });
    }
    lastDoneMap = { wsId: activeWorkspaceId, map: cur };
  }, [data, activeWorkspaceId, removeFocusTaskRecords, trackFocusCloudWrite]);

  // ── Derived views ──────────────────────────────────────────────────────────
  const all = Object.values(tasks).filter((t) => t && t.title);
  const openTasks = all.filter((task) => task.status !== "done");
  const doneTasks = all.filter((task) => task.status === "done");
  const buckets = useMemo(() => {
    const b = { overdue: [], today: [], upcoming: [], nodate: [], waiting: [], done: [] };
    all.forEach((t) => b[bucketOf(t, today)]?.push(t));
    Object.keys(b).forEach((k) => b[k].sort(taskOrder));
    b.overdue.sort((a, c) => (a.dueDate || "").localeCompare(c.dueDate || ""));
    b.done = b.done
      .filter((t) => (t.completedAt || "").slice(0, 10) >= addDays(today, -7))
      .sort((a, c) => String(c.completedAt || "").localeCompare(String(a.completedAt || "")));
    return b;
  }, [tasks, today]);

  const pinned = all.filter((t) => t.pinnedDate === today && t.status !== "done").sort(taskOrder);
  const doneToday = all.filter((t) => (t.completedAt || "").slice(0, 10) === today);
  const activeToday = buckets.overdue.length + buckets.today.length;
  const dueTodayCount = buckets.today.length;
  const streak = useMemo(() => computeStreak(tasks), [tasks]);
  const completedThisWeek = all.filter((t) => (t.completedAt || "").slice(0, 10) >= addDays(today, -6)).length;
  const existingSourceIds = useMemo(() => new Set(all.map((t) => t.sourceId).filter(Boolean)), [tasks]);
  // Tasks already pinned shouldn't repeat inside the buckets below.
  const pinnedIds = new Set(pinned.map((t) => t.id));
  const visible = (list) => list.filter((t) => !pinnedIds.has(t.id));

  // Efficiency counts (real numbers, not decoration).
  const openAll = [...buckets.overdue, ...buckets.today, ...buckets.upcoming, ...buckets.nodate, ...buckets.waiting];
  const stats = {
    due: buckets.today.length,
    overdue: buckets.overdue.length,
    pending: openAll.length,
    high: openAll.filter((t) => t.priority === "high").length,
  };
  const [focusView, setFocusView] = useState("priorities"); // priorities | all | done
  const workspaceTaskGroups = useMemo(() => {
    const known = new Map((workspaces || []).filter((ws) => ws?.id).map((ws, index) => [ws.id, { name: ws.name || ws.id, index }]));
    const groups = new Map();
    const viewTasks = focusView === "done"
      ? Object.values(tasks).filter((task) => task?.title && task.status === "done")
      : Object.values(tasks).filter((task) => task?.title && task.status !== "done");
    viewTasks.forEach((task) => {
      const wsId = task.sourceType === "document"
        ? String(task.sourceId || "").split(":")[0]
        : (task.workspaceId || "__focus");
      const knownWs = known.get(wsId);
      const key = wsId || "__focus";
      const fallbackName = task.sourceType === "document"
        ? (sourceWsLabel(task.sourceLabel) || "Other workspace")
        : (task.workspaceName || "Personal / Focus");
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name: knownWs?.name || fallbackName,
          order: key === activeWorkspaceId ? -1 : key === "__focus" ? 10000 : (knownWs?.index ?? 9000),
          tasks: [],
        });
      }
      groups.get(key).tasks.push(task);
    });
    return [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [tasks, workspaces, activeWorkspaceId, focusView]);

  const selectGroupTasks = useCallback((groupId, taskIds, checked) => {
    setGroupSelections((prev) => {
      const next = { ...prev };
      if (checked) next[groupId] = [...new Set(taskIds || [])];
      else delete next[groupId];
      return next;
    });
  }, []);

  const selectGroupTask = useCallback((groupId, taskId, checked) => {
    setGroupSelections((prev) => {
      const current = new Set(prev[groupId] || []);
      if (checked) current.add(taskId);
      else current.delete(taskId);
      const next = { ...prev };
      if (current.size) next[groupId] = [...current];
      else delete next[groupId];
      return next;
    });
  }, []);

  const deleteSelectedGroupTasks = useCallback((groupId) => {
    const ids = groupSelections[groupId] || [];
    if (!ids.length) return;
    if (ids.length > 1 && !confirm(`Delete ${ids.length} selected tasks from this workspace group?`)) return;
    deleteTasks(ids);
  }, [deleteTasks, groupSelections]);

  // ── Auto-fill Today's Priorities: top up EMPTY pin slots (up to 3) from
  // overdue first, then due-today tasks. Finishing a priority frees a slot, and
  // the next urgent dated task pushes up. If nothing is due, Priorities stays empty. Never
  // overrides your own pins and never re-adds something you unpinned today.
  useEffect(() => {
    if (pinned.length >= 3) return;
    const seed = readJson(LS_PINSEED, null);
    const unpinned = new Set(seed && seed.date === today ? (seed.userUnpinned || []) : []);
    const pinnedSet = new Set(pinned.map((t) => t.id));
    const candidates = [...buckets.overdue, ...buckets.today]
      .filter((t) => t && t.status !== "done" && !pinnedSet.has(t.id) && !unpinned.has(t.id));
    candidates.slice(0, 3 - pinned.length).forEach((t) => pinTask(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, pinned.length, today, pinTask]);

  return (
    <main className="page-main focus-home" style={{ gridColumn: "2 / -1", overflowY: "auto" }}>
      <div className="fx-shell">
        <div className="fx-hero">
          <div>
            <div className="fx-eyebrow">WAULT <b>HOME</b></div>
            <div className="fx-date">{prettyDate(today)}</div>
            <div className="fx-hero-counts">
              <span className={`fx-count-big${dueTodayCount > 0 ? " fx-count-accent" : ""}`}>
                <b>{dueTodayCount}</b> due today
              </span>
              {buckets.overdue.length > 0 && (
                <span className="fx-count-big fx-count-warn">
                  <b>{buckets.overdue.length}</b> overdue
                </span>
              )}
            </div>
          </div>
          <div className="fx-hero-side">
            {streak > 0 && <span className="fx-streak" data-tooltip={`${streak} day${streak === 1 ? "" : "s"} in a row with at least one task done — keep the flame alive`}>🔥 {streak}</span>}
            <span className={`fx-sync-state fx-sync-state-${localOnly ? "local" : focusSaveState}`}>
              <span className={`fx-sync${localOnly || focusSaveState === "failed" ? " fx-sync-off" : ""}`} />
              {localOnly ? "Local only" : focusSaveState === "saving" ? "Saving" : focusSaveState === "failed" ? "Failed" : "Saved"}
            </span>
            <ProgressRing done={doneToday.length} total={doneToday.length + activeToday} />
          </div>
        </div>

        {/* Efficiency counts — real numbers up top */}
        <div className="fx-stats">
          <span className={`fx-stat${stats.due > 0 ? " fx-stat-due" : ""}`} data-tooltip="Tasks due today"><b>{stats.due}</b> due today</span>
          <span className={`fx-stat${stats.overdue > 0 ? " fx-stat-overdue" : ""}`} data-tooltip="Tasks past their due date"><b>{stats.overdue}</b> overdue</span>
          <span className="fx-stat" data-tooltip="All open tasks (everything not done)"><b>{stats.pending}</b> pending</span>
          <span className={`fx-stat${stats.high > 0 ? " fx-stat-high" : ""}`} data-tooltip="Open tasks marked high priority"><b>{stats.high}</b> high priority</span>
        </div>

        <WorkspaceCards workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} data={data} onOpen={openWorkspace} />

        <QuickAdd onAdd={addTask} workspaces={workspaces} />

        <nav className="fx-viewnav" role="tablist" aria-label="WAULT Focus views">
          <button className={`fx-viewtab${focusView === "priorities" ? " fx-viewtab-on" : ""}`} role="tab" aria-selected={focusView === "priorities"} onClick={() => setFocusView("priorities")} type="button">
            Today's Priorities <span>{pinned.length}/3</span>
          </button>
          <button className={`fx-viewtab${focusView === "all" ? " fx-viewtab-on" : ""}`} role="tab" aria-selected={focusView === "all"} onClick={() => setFocusView("all")} type="button">
            All Tasks <span>{openTasks.length}</span>
          </button>
          <button className={`fx-viewtab${focusView === "done" ? " fx-viewtab-on" : ""}`} role="tab" aria-selected={focusView === "done"} onClick={() => setFocusView("done")} type="button">
            Done <span>{doneTasks.length}</span>
          </button>
        </nav>

        {focusView === "priorities" ? (
          <div className="fx-grid" role="tabpanel">
            <div className="fx-main">
              <section className="fx-bucket fx-b-pinned fx-focus-block fx-fade">
                <div className="fx-bucket-head">
                  <h2 className="fx-focus-title">Today's Priorities {pinned.length > 0 && <span className="fx-count">{pinned.length}/3</span>}</h2>
                  <span className="fx-bucket-sub">Auto-filled from overdue and today's due tasks — finish one and the next moves up. Pin your own with ☆.</span>
                </div>
                {pinned.length === 0
                  ? <div className="fx-empty">Nothing overdue or due today. When a task becomes urgent it rises here automatically.</div>
                  : pinned.map((t) => (
                      <TaskRow key={t.id} task={t} today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} big />
                    ))}
              </section>
              <Bucket id="today" tasks={visible(buckets.today)} today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} />
            </div>
            <aside className="fx-side">
              <MiniCalendar tasks={tasks} events={events} today={today} weekDone={completedThisWeek} />
            </aside>
          </div>
        ) : (
          <section className="fx-alltasks" role="tabpanel">
            <div className="fx-alltasks-head">
              <div>
                <h1>{focusView === "done" ? "Done" : "All Tasks"}</h1>
                <p>{focusView === "done" ? "Completed tasks, organized by workspace." : "Every unfinished task in WAULT, organized by workspace and then by due date."}</p>
              </div>
              <span className="fx-alltasks-total">{focusView === "done" ? doneTasks.length : openTasks.length} total</span>
            </div>
            {workspaceTaskGroups.length ? workspaceTaskGroups.map((group) => (
              <WorkspaceTaskGroup
                key={group.id}
                group={group}
                today={today}
                onPatch={patchTask}
                onDelete={deleteTask}
                onPin={pinTask}
                onOpenSource={openSource}
                doneOnly={focusView === "done"}
                selectedIds={new Set(groupSelections[group.id] || [])}
                onSelectTask={(taskId, checked) => selectGroupTask(group.id, taskId, checked)}
                onSelectAll={selectGroupTasks}
                onDeleteSelected={deleteSelectedGroupTasks}
              />
            )) : <div className="fx-empty fx-alltasks-empty">{focusView === "done" ? "No completed tasks yet." : "No unfinished tasks. Add your next task above."}</div>}
          </section>
        )}
      </div>
    </main>
  );
}

window.FocusHome = FocusHome;
})();
