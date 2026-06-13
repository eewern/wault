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
const LS_DAYS = "wault_focus_days";       // legacy (3-priority ritual) — read-only for migration
const LS_LATER = "wault_focus_later";     // legacy — migrated into tasks
const wsDataKey = (id) => `workspace_v4_data_${id}`;

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
    pinnedDate: "",            // YYYY-MM-DD when pinned to "Today's focus"
    notes: "",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...patch,
  };
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

// The whole point: the app decides where a task belongs.
function bucketOf(task, today) {
  if (task.status === "done") return "done";
  if (task.status === "waiting") return "waiting";
  if (task.dueDate && task.dueDate < today) return "overdue";
  if (task.dueDate === today || task.status === "in_progress") return "now";
  if (task.dueDate && task.dueDate <= addDays(today, 7)) return "next";
  if (!task.dueDate && task.priority === "high") return "next";
  return "later";
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
async function cloudLoadTasks(fb, uid) {
  try {
    const snap = await fb.get(fb.ref(fb.database, `focus/${uid}/tasks`));
    return snap.exists() ? (snap.val() || {}) : {};
  } catch (e) {
    console.warn("FocusHome: cloud load failed:", e.message);
    return null;
  }
}
function cloudSaveTask(fb, uid, task) {
  if (!fb || !uid || !task?.id) return;
  fb.set(fb.ref(fb.database, `focus/${uid}/tasks/${task.id}`), task)
    .catch((e) => console.warn("FocusHome: task save failed:", e.message));
}
// Stamp a task with this session's id before storing it ANYWHERE (local + cloud
// hold identical copies): saveId lets the live listener skip our own echoes and
// protects this session's fresh tasks from stale remote-deletion snapshots.
const stamped = (task) => ({ ...task, saveId: SESSION_ID, updatedAt: new Date().toISOString() });
function cloudDeleteTask(fb, uid, taskId) {
  if (!fb || !uid || !taskId) return;
  fb.set(fb.ref(fb.database, `focus/${uid}/tasks/${taskId}`), null)
    .catch((e) => console.warn("FocusHome: task delete failed:", e.message));
}

function mergeTaskMaps(local, cloud) {
  const out = { ...(local || {}) };
  Object.entries(cloud || {}).forEach(([id, t]) => {
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

// Legacy write-back for NON-ACTIVE workspaces only (active ws goes through
// completeChecklistItem → host setData, or the host's save effect would clobber
// a direct localStorage write within 200ms).
function completeWorkspaceItem(sourceId, done) {
  try {
    const [wsId, pageId, itemId] = String(sourceId).split(":");
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

function QuickAdd({ onAdd }) {
  const [value, setValue] = useState("");
  const parsed = useMemo(() => parseQuickAdd(value), [value]);
  const submit = () => {
    if (!parsed.title) return;
    onAdd(parsed);
    setValue("");
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
      <button className="fx-quickadd-go" onClick={submit} disabled={!parsed.title} data-tooltip="Add this task (or press Enter)">Add</button>
    </div>
  );
}

const NEXT_PRIORITY = { high: "medium", medium: "low", low: "high" };

function TaskRow({ task, today, onPatch, onDelete, onPin, onOpenSource, big = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef(null);
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

  return (
    <div className={`fx-task${big ? " fx-task-big" : ""}${done ? " fx-task-done" : ""}${leaving ? " fx-task-leaving" : ""}`}>
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
        <span className="fx-task-meta">
          <button
            className={`fx-pill fx-pill-${task.priority}`}
            onClick={() => onPatch(task.id, { priority: NEXT_PRIORITY[task.priority] || "medium" })}
            data-tooltip="Click to cycle priority: high → medium → low"
          >{task.priority}</button>
          <label className={`fx-pill fx-pill-due${overdue ? " fx-overdue" : ""}${dueToday ? " fx-today" : ""}`} data-tooltip="Click to pick a due date">
            {task.dueDate ? shortDate(task.dueDate) : "no date"}
            <input
              type="date"
              value={task.dueDate || ""}
              onChange={(e) => onPatch(task.id, { dueDate: e.target.value })}
            />
          </label>
          {task.sourceType === "document" && task.sourceLabel && (
            <button className="fx-task-src" onClick={() => onOpenSource?.(task)} data-tooltip={`Open the source page: ${task.sourceLabel}`}>📄 {task.sourceLabel}</button>
          )}
        </span>
      </div>
      <span className="fx-task-actions">
        {!done && (
          <React.Fragment>
            <button className="fx-mini" data-tooltip="Snooze — push the due date to tomorrow" onClick={() => onPatch(task.id, { dueDate: addDays(today, 1), status: task.status === "waiting" ? "todo" : task.status })}>⤳</button>
            {task.status !== "waiting"
              ? <button className="fx-mini" data-tooltip="Move to Waiting — blocked on someone else" onClick={() => onPatch(task.id, { status: "waiting" })}>⏳</button>
              : <button className="fx-mini" data-tooltip="Unblock — move back to To-do" onClick={() => onPatch(task.id, { status: "todo" })}>▶</button>}
            {task.status !== "in_progress"
              ? <button className="fx-mini" data-tooltip="Start working — moves it into Now" onClick={() => onPatch(task.id, { status: "in_progress" })}>◐</button>
              : <button className="fx-mini" data-tooltip="Pause — stop working on this for now" onClick={() => onPatch(task.id, { status: "todo" })}>∥</button>}
            <button
              className={`fx-mini${task.pinnedDate === today ? " fx-pin-on" : ""}`}
              data-tooltip={task.pinnedDate === today ? "Unpin from Today's focus" : "Pin to Today's focus — your top 3 for the day"}
              onClick={() => onPin(task.id)}
            >{task.pinnedDate === today ? "★" : "☆"}</button>
          </React.Fragment>
        )}
        <button className="fx-mini fx-mini-del" data-tooltip="Delete this task (the workspace to-do stays)" onClick={() => onDelete(task.id)}>×</button>
      </span>
    </div>
  );
}

const BUCKET_META = {
  overdue: { title: "Overdue",  cls: "fx-b-overdue", sub: "Past due — clear these or move the date.", empty: "Nothing overdue. Clean slate." },
  now:     { title: "Now",      cls: "fx-b-now",     sub: "Due today or in progress.", empty: "Nothing due today. Pin something or pull from Next." },
  next:    { title: "Next",     cls: "fx-b-next",    sub: "Coming up within a week.", empty: "Nothing queued for this week yet." },
  later:   { title: "Later",    cls: "fx-b-later",   sub: "Parked. Out of your head, not forgotten.", empty: "Empty — park future things here with no date." },
  waiting: { title: "Waiting",  cls: "fx-b-waiting", sub: "Blocked on someone or something else.", empty: "Not waiting on anyone." },
};

function Bucket({ id, tasks, today, onPatch, onDelete, onPin, onOpenSource }) {
  const meta = BUCKET_META[id];
  // Don't render big empty boxes for the quiet buckets — only Now keeps a
  // guiding empty state, the rest collapse to nothing when empty.
  if (!tasks.length && id !== "now") return null;
  return (
    <section className={`fx-bucket ${meta.cls} fx-fade`}>
      <div className="fx-bucket-head">
        <h2>{meta.title} {tasks.length > 0 && <span className="fx-count">{tasks.length}</span>}</h2>
        <span className="fx-bucket-sub">{meta.sub}</span>
      </div>
      {tasks.length === 0
        ? <div className="fx-empty">{meta.empty}</div>
        : tasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} />
          ))}
    </section>
  );
}

function DoneSection({ tasks, today, onPatch, onDelete, onPin, onOpenSource }) {
  const [open, setOpen] = useState(false);
  if (!tasks.length) return null;
  return (
    <section className="fx-bucket fx-b-done fx-fade">
      <button className="fx-done-toggle" onClick={() => setOpen(!open)} data-tooltip={open ? "Collapse the done list" : "Show what you finished in the last 7 days"}>
        <span className={`fx-done-chev${open ? " fx-open" : ""}`}>▸</span>
        Done <span className="fx-count">{tasks.length}</span>
        <span className="fx-bucket-sub" style={{ marginLeft: 8 }}>last 7 days</span>
      </button>
      {open && tasks.map((t) => (
        <TaskRow key={t.id} task={t} today={today} onPatch={onPatch} onDelete={onDelete} onPin={onPin} onOpenSource={onOpenSource} />
      ))}
    </section>
  );
}

function MiniCalendar({ tasks, events, today }) {
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
  const fresh = suggestions.filter((s) => !existingSourceIds.has(s.sourceId));
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
function FocusHome({ data, activeWorkspaceId, workspaces, authUser, switchWorkspace, setCurrentPage, completeChecklistItem, cloudConnected }) {
  const [today, setToday] = useState(todayKey());
  const [tasks, setTasks] = useState(() => migrateLegacy(readJson(LS_TASKS, {})));
  const [otherSuggestions, setOtherSuggestions] = useState([]); // non-active workspaces
  const [otherEvents, setOtherEvents] = useState([]);

  const fbRef = useRef(null);
  const uidRef = useRef(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const localOnly = !cloudConnected || !authUser;

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
            if (!cloud[t.id]) cloudSaveTask(fb, uid, t);
          });
          return merged;
        });
      }
      if (cancelled) return;
      try {
        unsub = fb.onValue(fb.ref(fb.database, `focus/${uid}/tasks`), (snap) => {
          const val = snap.exists() ? (snap.val() || {}) : {};
          setTasks((prev) => {
            let changed = false;
            const next = { ...prev };
            Object.entries(val).forEach(([id, t]) => {
              if (t?.saveId === SESSION_ID) return;
              const cur = next[id];
              if (!cur || String(t?.updatedAt || "") > String(cur.updatedAt || "")) { next[id] = t; changed = true; }
            });
            Object.keys(next).forEach((id) => {
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

  // Suggestions + events from the ACTIVE workspace come from the live data prop
  // (instant), other workspaces from their localStorage caches (scan on mount).
  const activeWsName = useMemo(
    () => (workspaces || []).find((w) => w.id === activeWorkspaceId)?.name || "This workspace",
    [workspaces, activeWorkspaceId]
  );
  const activeSuggestions = useMemo(() => {
    const out = [];
    scanWorkspaceData(activeWorkspaceId, activeWsName, data, new Set(), out);
    out.sort((a, b) => (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1);
    return out;
  }, [data, activeWorkspaceId, activeWsName]);

  useEffect(() => {
    const others = (workspaces || []).filter((w) => w?.id && w.id !== activeWorkspaceId).slice(0, 10);
    const out = [];
    const seen = new Set();
    const evs = [];
    others.forEach((ws) => {
      const cached = readJson(wsDataKey(ws.id), null);
      if (cached) {
        scanWorkspaceData(ws.id, ws.name, cached, seen, out);
        Object.values(cached.events || {}).forEach((ev) => {
          if (ev?.date && ev?.title) evs.push({ ...ev, wsName: ws.name || ws.id });
        });
      }
    });
    setOtherSuggestions(out);
    setOtherEvents(evs);
  }, [workspaces, activeWorkspaceId]);

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
    cloudSaveTask(fbRef.current, uidRef.current, t);
  }, []);

  const patchTask = useCallback((id, patch) => {
    setTasks((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const updated = stamped({ ...cur, ...patch });
      // Focus→Main: imported tasks mirror completion into the source checklist.
      // Active workspace rides host state (full save pipeline + undo); other
      // workspaces fall back to the legacy localStorage write.
      if (cur.sourceType === "document" && "status" in patch) {
        const [wsId, pageId, itemId] = String(cur.sourceId).split(":");
        if (wsId && wsId === activeWorkspaceId && typeof completeChecklistItem === "function") {
          completeChecklistItem(pageId, itemId, updated.status === "done");
        } else {
          completeWorkspaceItem(cur.sourceId, updated.status === "done");
        }
      }
      const next = { ...prev, [id]: updated };
      writeJson(LS_TASKS, next);
      cloudSaveTask(fbRef.current, uidRef.current, updated);
      return next;
    });
  }, [activeWorkspaceId, completeChecklistItem]);

  const deleteTask = useCallback((id) => {
    setTasks((prev) => {
      const next = { ...prev };
      delete next[id];
      writeJson(LS_TASKS, next);
      return next;
    });
    cloudDeleteTask(fbRef.current, uidRef.current, id);
  }, []);

  const addTask = useCallback(({ title, priority, dueDate }) => {
    commitTask(makeTask({ title, priority, dueDate }));
  }, [commitTask]);

  const importSuggestion = useCallback((s) => {
    commitTask(makeTask({
      title: s.title,
      dueDate: s.dueDate || "",
      sourceType: "document",
      sourceId: s.sourceId,
      sourceLabel: `${s.pageTitle} · ${s.wsName}`,
    }));
  }, [commitTask]);

  const pinTask = useCallback((id) => {
    setTasks((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const pinnedNow = Object.values(prev).filter((t) => t.pinnedDate === todayKey() && t.status !== "done");
      const isPinned = cur.pinnedDate === todayKey();
      if (!isPinned && pinnedNow.length >= 3) return prev; // Top 3 means three.
      const updated = stamped({ ...cur, pinnedDate: isPinned ? "" : todayKey() });
      const next = { ...prev, [id]: updated };
      writeJson(LS_TASKS, next);
      cloudSaveTask(fbRef.current, uidRef.current, updated);
      return next;
    });
  }, []);

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
      cloudSaveTask(fbRef.current, uidRef.current, updated);
    };

    const docTasks = Object.values(tasksRef.current).filter((t) => t?.sourceType === "document" && t.sourceId);
    const prev = lastDoneMap;

    if (!prev || prev.wsId !== activeWorkspaceId) {
      // Baseline (mount or workspace switch): completions are sticky — propagate
      // done=true from checklist to task, never un-complete from a baseline.
      docTasks.forEach((t) => {
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
  }, [data, activeWorkspaceId]);

  // ── Derived views ──────────────────────────────────────────────────────────
  const all = Object.values(tasks).filter((t) => t && t.title);
  const buckets = useMemo(() => {
    const b = { overdue: [], now: [], next: [], later: [], waiting: [], done: [] };
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
  const activeToday = buckets.overdue.length + buckets.now.length + pinned.filter((t) => bucketOf(t, today) !== "now" && bucketOf(t, today) !== "overdue").length;
  const dueTodayCount = buckets.now.filter((t) => t.dueDate === today).length;
  const streak = useMemo(() => computeStreak(tasks), [tasks]);
  const completedThisWeek = all.filter((t) => (t.completedAt || "").slice(0, 10) >= addDays(today, -6)).length;
  const existingSourceIds = useMemo(() => new Set(all.map((t) => t.sourceId).filter(Boolean)), [tasks]);
  // Tasks already pinned shouldn't repeat inside the buckets below.
  const pinnedIds = new Set(pinned.map((t) => t.id));
  const visible = (list) => list.filter((t) => !pinnedIds.has(t.id));

  return (
    <main className="page-main focus-home" style={{ gridColumn: "2 / -1", overflowY: "auto" }}>
      <div className="fx-shell">
        <div className="fx-hero">
          <div>
            <div className="fx-eyebrow">WAULT <b>HOME</b></div>
            <div className="fx-date">{prettyDate(today)}</div>
            <div className="fx-sub">
              {buckets.overdue.length > 0 && <span className="fx-sub-warn">{buckets.overdue.length} overdue</span>}
              {buckets.overdue.length > 0 && " · "}
              {dueTodayCount > 0 ? `${dueTodayCount} due today` : "nothing due today"}
            </div>
          </div>
          <div className="fx-hero-side">
            {streak > 0 && <span className="fx-streak" data-tooltip={`${streak} day${streak === 1 ? "" : "s"} in a row with at least one task done — keep the flame alive`}>🔥 {streak}</span>}
            <span className={`fx-sync${localOnly ? " fx-sync-off" : ""}`} data-tooltip={localOnly ? "Local-only — tasks saved in this browser" : "Synced to your account"} />
            <ProgressRing done={doneToday.length} total={doneToday.length + activeToday} />
          </div>
        </div>

        <QuickAdd onAdd={addTask} />

        <WorkspaceCards workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} data={data} onOpen={openWorkspace} />

        <div className="fx-grid">
          <div className="fx-main">
            <section className="fx-bucket fx-b-pinned fx-fade">
              <div className="fx-bucket-head">
                <h2>Today's focus {pinned.length > 0 && <span className="fx-count">{pinned.length}/3</span>}</h2>
                <span className="fx-bucket-sub">Pin up to three with ☆ — if you do nothing else, do these.</span>
              </div>
              {pinned.length === 0
                ? <div className="fx-empty">Nothing pinned yet. Hover a task and hit ☆ to make it today's focus.</div>
                : pinned.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} big />
                  ))}
            </section>
            <Bucket id="overdue" tasks={visible(buckets.overdue)} today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} />
            <Bucket id="now"     tasks={visible(buckets.now)}     today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} />
            <Bucket id="next"    tasks={visible(buckets.next)}    today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} />
            <Bucket id="waiting" tasks={visible(buckets.waiting)} today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} />
            <Bucket id="later"   tasks={visible(buckets.later)}   today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} />
            <DoneSection tasks={buckets.done} today={today} onPatch={patchTask} onDelete={deleteTask} onPin={pinTask} onOpenSource={openSource} />
          </div>
          <aside className="fx-side">
            <MiniCalendar tasks={tasks} events={events} today={today} />
            <Upcoming tasks={tasks} events={events} today={today} />
            <WorkspacePull suggestions={suggestions} existingSourceIds={existingSourceIds} onImport={importSuggestion} />
            <div className="fx-card fx-week">
              <span className="fx-week-num">{completedThisWeek}</span>
              <span className="fx-week-label">task{completedThisWeek === 1 ? "" : "s"} completed this week</span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

window.FocusHome = FocusHome;
})();
