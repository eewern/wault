(function attachWaultReliability(root) {
  "use strict";

  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
  const clone = (value) => {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  };

  function deepEqual(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
      return left.every((value, index) => deepEqual(value, right[index]));
    }
    if (isObject(left) || isObject(right)) {
      if (!isObject(left) || !isObject(right)) return false;
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      return leftKeys.every((key) => hasOwn(right, key) && deepEqual(left[key], right[key]));
    }
    return false;
  }

  function mergePrimitiveArray(base = [], local = [], remote = []) {
    if (deepEqual(local, remote)) return clone(local);
    if (deepEqual(local, base)) return clone(remote);
    if (deepEqual(remote, base)) return clone(local);

    const baseSet = new Set(base);
    const localSet = new Set(local);
    const remoteSet = new Set(remote);
    const removed = new Set(base.filter((value) => !localSet.has(value) || !remoteSet.has(value)));
    const ordered = [...local, ...remote, ...base];
    return [...new Set(ordered)].filter((value) => !removed.has(value) && (localSet.has(value) || remoteSet.has(value) || !baseSet.has(value)));
  }

  function isEntityArray(value) {
    return Array.isArray(value) && value.every((item) => isObject(item) && typeof item.id === "string" && item.id);
  }

  function mergeEntityArray(base, local, remote) {
    const baseMap = new Map(base.map((item) => [item.id, item]));
    const localMap = new Map(local.map((item) => [item.id, item]));
    const remoteMap = new Map(remote.map((item) => [item.id, item]));
    const ids = mergePrimitiveArray(
      base.map((item) => item.id),
      local.map((item) => item.id),
      remote.map((item) => item.id)
    );

    return ids.flatMap((id) => {
      const baseItem = baseMap.get(id);
      const localItem = localMap.get(id);
      const remoteItem = remoteMap.get(id);
      if (!localItem || !remoteItem) return [clone(localItem || remoteItem)].filter(Boolean);
      return [mergeValue(baseItem || {}, localItem, remoteItem)];
    });
  }

  function mergeObject(base, local, remote) {
    const out = {};
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote || {})]);
    keys.forEach((key) => {
      const baseHas = hasOwn(base, key);
      const localHas = hasOwn(local, key);
      const remoteHas = hasOwn(remote, key);

      if (!localHas && !remoteHas) return;
      if (!localHas) {
        if (baseHas) return; // A deletion wins over a concurrent edit to prevent resurrection.
        out[key] = clone(remote[key]);
        return;
      }
      if (!remoteHas) {
        if (baseHas) return;
        out[key] = clone(local[key]);
        return;
      }
      out[key] = mergeValue(baseHas ? base[key] : undefined, local[key], remote[key]);
    });
    return out;
  }

  function mergeValue(base, local, remote) {
    if (deepEqual(local, remote)) return clone(local);
    if (deepEqual(local, base)) return clone(remote);
    if (deepEqual(remote, base)) return clone(local);

    if (Array.isArray(local) && Array.isArray(remote)) {
      const baseArray = Array.isArray(base) ? base : [];
      if (isEntityArray(local) && isEntityArray(remote) && isEntityArray(baseArray)) {
        return mergeEntityArray(baseArray, local, remote);
      }
      if (local.every((value) => typeof value === "string") && remote.every((value) => typeof value === "string")) {
        return mergePrimitiveArray(baseArray, local, remote);
      }
      return clone(local);
    }

    if (isObject(local) && isObject(remote)) {
      return mergeObject(isObject(base) ? base : {}, local, remote);
    }

    // Same-field conflicts keep the current editor's value. The remote pre-image
    // remains recoverable in Firebase history, while unrelated remote edits merge in.
    return clone(local);
  }

  function mergeWorkspaceConflict(base, local, remote) {
    return mergeValue(base || {}, local || {}, remote || {});
  }

  function firebaseSaveSucceeded(result) {
    return result === true || result?.ok === true;
  }

  function normalizeNumberListStart(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(999999, parsed));
  }

  function parseListPrefixShortcut(plainText, caretOffset, spaceAlreadyInserted = false) {
    const text = String(plainText || "").replace(/\u200B/g, "");
    const offset = Math.max(0, Math.min(text.length, Number(caretOffset) || 0));
    const prefix = text.slice(0, offset);
    const optionalSpace = spaceAlreadyInserted ? "[ \\u00a0]" : "";
    const numberMatch = prefix.match(new RegExp(`^(\\d{1,6})[.)]${optionalSpace}$`));
    if (numberMatch) {
      return {
        type: "numbers",
        start: normalizeNumberListStart(numberMatch[1]),
      };
    }
    if (new RegExp(`^[-*\\u2022]${optionalSpace}$`).test(prefix)) {
      return { type: "bullets" };
    }
    return null;
  }

  function splitListBlockForShortcut(block, itemId, shortcut, makeId) {
    const items = Array.isArray(block?.items) ? block.items : [];
    const index = items.findIndex((item) => item?.id === itemId);
    const type = shortcut?.type;
    if (index < 0 || (type !== "bullets" && type !== "numbers") || typeof makeId !== "function") return null;

    const beforeItems = items.slice(0, index);
    const afterItems = items.slice(index + 1);
    const convertedId = beforeItems.length ? makeId() : block.id;
    const convertedItem = {
      id: makeId(),
      text: String(shortcut.remainingHtml || ""),
    };
    const start = normalizeNumberListStart(shortcut.start);
    const converted = {
      id: convertedId,
      type,
      items: [convertedItem],
      ...(type === "numbers" && start > 1 ? { start } : {}),
    };

    const blocks = [];
    if (beforeItems.length) blocks.push({ ...block, items: beforeItems });
    blocks.push(converted);

    if (afterItems.length) {
      let afterBlock = { ...block, id: makeId(), items: afterItems };
      if (block.type === "numbers") {
        const consumedTopLevel = beforeItems.filter((item) => {
          const level = Number(item?.level ?? (item?.indent ? 1 : 0)) || 0;
          return level <= 0;
        }).length;
        const nextStart = normalizeNumberListStart(block.start) + consumedTopLevel;
        if (nextStart > 1) afterBlock = { ...afterBlock, start: nextStart };
        else {
          const { start: _start, ...withoutStart } = afterBlock;
          afterBlock = withoutStart;
        }
      }
      blocks.push(afterBlock);
    }

    return { blocks, focusId: convertedId, focusItemId: convertedItem.id };
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function dedupeTeamMembers(list = [], currentUser = {}) {
    const currentUid = String(currentUser?.uid || "");
    const currentEmail = normalizeEmail(currentUser?.email);
    const seen = new Map();

    (Array.isArray(list) ? list : []).forEach((member) => {
      if (!member) return;
      const email = normalizeEmail(member.email);
      const uid = String(member.uid || "");
      const key = email || uid.toLowerCase();
      if (!key) return;
      const candidate = { ...member, uid, email };
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, candidate);
        return;
      }

      const candidateIsCurrent = !!currentUid && uid === currentUid;
      const existingIsCurrent = !!currentUid && existing.uid === currentUid;
      if (candidateIsCurrent && !existingIsCurrent) {
        seen.set(key, candidate);
        return;
      }
      if (existingIsCurrent) return;

      const candidateMatchesEmail = !!currentEmail && email === currentEmail;
      const existingMatchesEmail = !!currentEmail && normalizeEmail(existing.email) === currentEmail;
      if (candidateMatchesEmail && !existingMatchesEmail) {
        seen.set(key, candidate);
        return;
      }

      const candidateTime = Date.parse(candidate.addedAt || "") || 0;
      const existingTime = Date.parse(existing.addedAt || "") || 0;
      if (candidateTime > existingTime) seen.set(key, candidate);
    });

    return [...seen.values()];
  }

  function classifySyncStatus(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const lower = text.toLowerCase();
    const failed = [
      "failed",
      "offline",
      "blocked",
      "rejected",
      "skipped",
      "missing",
      "unavailable",
      "denied",
      "timeout",
      "stale",
      "cache",
      "preview",
      "not configured",
      "not authenticated",
      "not approved",
      "delayed",
    ].some((marker) => lower.includes(marker));
    if (failed) return { label: "Failed", tone: "failed", detail: text };

    const saving = ["saving", "restoring", "merging", "newer changes", "pending retry"]
      .some((marker) => lower.includes(marker));
    if (saving) return { label: "Saving", tone: "saving", detail: text };

    const confirmed = (
      (lower.includes("synced to cloud") && text.includes("✓"))
      || (lower.includes("saved") && text.includes("✓"))
    );
    if (confirmed) return { label: "Saved", tone: "saved", detail: text };

    return { label: "Not synced", tone: "pending", detail: text };
  }

  function workspaceDataEqual(left, right) {
    if (!left || !right) return left === right;
    // `currentPageId` is private navigation state. Two browsers can look at
    // different pages without changing the shared workspace document.
    const leftShared = isObject(left) ? { ...left } : left;
    const rightShared = isObject(right) ? { ...right } : right;
    if (isObject(leftShared)) delete leftShared.currentPageId;
    if (isObject(rightShared)) delete rightShared.currentPageId;
    return deepEqual(leftShared, rightShared);
  }

  function shouldFinalizeAcknowledgedSave(savedData, latestSave, workspaceId) {
    return !!latestSave && latestSave.ws === workspaceId && latestSave.data === savedData;
  }

  function workspaceContextMatches(listenerWorkspaceId, activeWorkspaceId, loadedWorkspaceId) {
    return !!listenerWorkspaceId && listenerWorkspaceId === activeWorkspaceId && listenerWorkspaceId === loadedWorkspaceId;
  }

  function shouldReplayDraft(draft, remoteUpdatedAt = "", remoteRevision = null) {
    if (!draft?.data?.pages || !draft.savedAt) return false;
    const pendingMs = Date.parse(draft.savedAt) || 0;
    const remoteMs = Date.parse(remoteUpdatedAt || "") || 0;
    if (pendingMs <= remoteMs) return false;
    if (!remoteMs) return true;

    const draftRevision = Number(draft.baseRevision);
    const currentRevision = Number(remoteRevision);
    const hasReliableRevision = Number.isFinite(draftRevision) && Number.isFinite(currentRevision) && (draftRevision > 0 || currentRevision > 0);
    if (hasReliableRevision) return draftRevision === currentRevision;

    const baseMs = Date.parse(draft.baseUpdatedAt || "") || 0;
    return !!baseMs && remoteMs <= baseMs;
  }

  function normalizeParentSubpageLinks(data, options = {}) {
    if (!data?.pages) return data;
    const pages = { ...data.pages };
    let changed = false;
    const expectedParent = new Map();
    Object.values(pages).forEach((child) => {
      if (!child?.id || !child.parentId) return;
      const parent = pages[child.parentId];
      if (parent && !parent.system) expectedParent.set(child.id, child.parentId);
    });

    Object.entries(pages).forEach(([pageId, page]) => {
      if (!Array.isArray(page?.blocks)) return;
      const seen = new Set();
      const blocks = page.blocks.filter((block) => {
        if (block?.type !== "subpage") return true;
        if (!(block.pageId && pages[block.pageId] && expectedParent.get(block.pageId) === pageId)) return false;
        if (seen.has(block.pageId)) return false;
        seen.add(block.pageId);
        return true;
      });
      if (blocks.length === page.blocks.length) return;
      const normalizedBlocks = typeof options.ensureTrailingTextBlock === "function"
        ? options.ensureTrailingTextBlock(blocks)
        : blocks;
      pages[pageId] = { ...page, blocks: normalizedBlocks };
      changed = true;
    });

    expectedParent.forEach((parentId, childId) => {
      const parent = pages[parentId];
      if (!parent || parent.system) return;
      const blocks = Array.isArray(parent.blocks) ? [...parent.blocks] : [];
      if (blocks.some((block) => block?.type === "subpage" && block.pageId === childId)) return;
      const link = { id: `sub_${childId}`, type: "subpage", pageId: childId };
      const last = blocks[blocks.length - 1];
      const blank = typeof options.isBlankTextBlock === "function"
        ? options.isBlankTextBlock(last)
        : !!(last?.type === "text" && !String(last.text || "").replace(/<[^>]+>/g, "").trim());
      if (blank) blocks.splice(blocks.length - 1, 0, link);
      else blocks.push(link);
      pages[parentId] = { ...parent, blocks };
      changed = true;
    });

    return changed ? { ...data, pages } : data;
  }

  root.WaultReliability = {
    classifySyncStatus,
    deepEqual,
    dedupeTeamMembers,
    firebaseSaveSucceeded,
    mergeWorkspaceConflict,
    normalizeNumberListStart,
    normalizeParentSubpageLinks,
    parseListPrefixShortcut,
    shouldFinalizeAcknowledgedSave,
    shouldReplayDraft,
    splitListBlockForShortcut,
    workspaceDataEqual,
    workspaceContextMatches,
  };
})(typeof window !== "undefined" ? window : globalThis);
