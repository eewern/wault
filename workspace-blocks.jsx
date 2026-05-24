// === Block components with slash commands, rich text, and inline editing ===
const { useState, useRef, useEffect, useCallback, useMemo } = React;

const ALLOWED_INLINE_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "BR"]);

function sanitizeHtml(input = "") {
  const template = document.createElement("template");
  template.innerHTML = String(input);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode("");

    const tag = node.tagName;
    if (tag === "DIV" || tag === "P") {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((child) => frag.appendChild(cleanNode(child)));
      frag.appendChild(document.createElement("br"));
      return frag;
    }

    if (!ALLOWED_INLINE_TAGS.has(tag)) {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((child) => frag.appendChild(cleanNode(child)));
      return frag;
    }

    const el = document.createElement(tag.toLowerCase());
    node.childNodes.forEach((child) => el.appendChild(cleanNode(child)));
    return el;
  };

  const out = document.createElement("div");
  template.content.childNodes.forEach((node) => out.appendChild(cleanNode(node)));
  return out.innerHTML;
}
window.sanitizeHtml = sanitizeHtml;

function stripHtml(input = "") {
  const temp = document.createElement("div");
  temp.innerHTML = sanitizeHtml(input);
  temp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return (temp.textContent || "").replace(/\u200B/g, "");
}
window.stripHtml = stripHtml;

function insertTextAtCursor(text) {
  if (document.queryCommandSupported?.("insertText")) {
    document.execCommand("insertText", false, text);
    return;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  sel.deleteFromDocument();
  sel.getRangeAt(0).insertNode(document.createTextNode(text));
  sel.collapseToEnd();
}

function insertSoftBreakAtCursor() {
  if (document.queryCommandSupported?.("insertHTML")) {
    document.execCommand("insertHTML", false, "<br>\u200B");
    return;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode("\u200B"));
  range.insertNode(document.createElement("br"));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function htmlEscape(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert inline markdown (**bold**, *italic*, ~~strike~~, _italic_) to HTML.
// HTML-escapes plain text first so raw < > & don't leak through.
function parseInlineMd(raw = "") {
  return raw
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/_(.+?)_/g, "<i>$1</i>");
}

// Extract only the direct text/inline content of a <li>, excluding nested lists and icon nodes.
// Returns sanitized HTML string safe for EditableText.
function liDirectText(li) {
  const clone = li.cloneNode(true);
  // Strip icon/checkbox elements
  clone.querySelectorAll("svg, img, input, [role='img'], [role='checkbox']").forEach(el => el.remove());
  // Strip nested lists — those are handled recursively as child items
  clone.querySelectorAll("ul, ol").forEach(el => el.remove());
  return sanitizeHtml(clone.innerHTML || "").replace(/<br\s*\/?>\s*$/i, "").trim();
}

// Recursively extract flat list items with level numbers from a <ul> or <ol> node.
// Returns array of { id, text, level, done?, dueDate? }
function extractListItems(listNode, level = 0) {
  const items = [];
  const lis = Array.from(listNode.querySelectorAll(":scope > li"));
  for (const li of lis) {
    const text = liDirectText(li);
    const hasCheckbox = li.querySelector('input[type="checkbox"]') || li.querySelector('[role="checkbox"]');
    const item = { id: nid(), text, level };
    if (hasCheckbox) {
      const cb = li.querySelector('input[type="checkbox"]');
      const roleCb = li.querySelector('[role="checkbox"]');
      item.done = cb ? cb.checked : (roleCb?.getAttribute("aria-checked") === "true");
      item.dueDate = "";
    }
    if (text) items.push(item);
    // Recurse into nested lists within this <li>
    li.querySelectorAll(":scope > ul, :scope > ol").forEach(nested => {
      const children = extractListItems(nested, level + 1);
      items.push(...children);
    });
  }
  return items;
}

// Parse rich HTML clipboard data (from Notion, Google Docs, etc.) into blocks.
function parseHtmlBlocks(html = "") {
  const match = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/);
  const fragment = match ? match[1] : html;
  const container = document.createElement("div");
  container.innerHTML = fragment;

  const blocks = [];

  const inlineHtml = (node) => sanitizeHtml(node.innerHTML || "");

  const processNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim();
      if (t) blocks.push({ id: nid(), type:"text", text: htmlEscape(t) });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toUpperCase();

    if (tag === "H1" || tag === "H2" || tag === "H3") {
      const text = inlineHtml(node);
      if (node.textContent?.trim()) blocks.push({ id: nid(), type:"heading", level: parseInt(tag[1]), text });
      return;
    }
    if (tag === "P") {
      const text = inlineHtml(node);
      if (node.textContent?.trim()) blocks.push({ id: nid(), type:"text", text });
      return;
    }
    if (tag === "UL" || tag === "OL") {
      const items = extractListItems(node, 0);
      if (!items.length) return;
      // Checklist: any item that has done property set
      if (items.some(i => "done" in i)) {
        blocks.push({ id: nid(), type:"checklist", items: items.map(i => ({ id: i.id, text: i.text, done: i.done || false, dueDate: i.dueDate || "" })) });
      } else if (tag === "OL") {
        blocks.push({ id: nid(), type:"numbers", items });
      } else {
        blocks.push({ id: nid(), type:"bullets", items });
      }
      return;
    }
    if (tag === "BLOCKQUOTE") {
      const text = inlineHtml(node);
      if (node.textContent?.trim()) blocks.push({ id: nid(), type:"callout", icon:"💡", text });
      return;
    }
    if (tag === "HR") {
      blocks.push({ id: nid(), type:"divider" });
      return;
    }
    if (tag === "TABLE") {
      const headerCells = Array.from(node.querySelectorAll("thead th, thead td, tr:first-child th, tr:first-child td"))
        .map(c => (window.stripHtml ? window.stripHtml(c.innerHTML) : c.textContent || "").trim());
      const bodyRows = Array.from(node.querySelectorAll("tbody tr, tr:not(:first-child)")).map(tr => ({
        id: nid(),
        cells: Array.from(tr.querySelectorAll("td, th")).map(c => (window.stripHtml ? window.stripHtml(c.innerHTML) : c.textContent || "").trim()),
      }));
      if (headerCells.length) blocks.push({ id: nid(), type:"table", headers: headerCells, rows: bodyRows.length ? bodyRows : [{ id: nid(), cells: headerCells.map(() => "") }] });
      return;
    }
    // DIV / SECTION / ARTICLE / SPAN / etc. — recurse into children
    node.childNodes.forEach(processNode);
  };

  container.childNodes.forEach(processNode);
  return blocks;
}
window.parseHtmlBlocks = parseHtmlBlocks;

// Serialize a block to semantic HTML so the clipboard carries proper structure.
function serializeBlockToHtml(block) {
  const s = (t) => t || "";
  switch (block.type) {
    case "heading":  return `<h${block.level}>${s(block.text)}</h${block.level}>`;
    case "text":     return `<p>${s(block.text)}</p>`;
    case "callout":  return `<blockquote>${s(block.text)}</blockquote>`;
    case "divider":  return `<hr>`;
    case "bullets":
      return `<ul>${(block.items||[]).map(i=>`<li>${s(i.text)}</li>`).join("")}</ul>`;
    case "numbers":
      return `<ol>${(block.items||[]).map(i=>`<li>${s(i.text)}</li>`).join("")}</ol>`;
    case "checklist":
      return `<ul>${(block.items||[]).map(i=>`<li>${i.done?"[x]":"[ ]"} ${s(i.text)}</li>`).join("")}</ul>`;
    case "table": {
      const hdrs = (block.headers||[]).map(h=>`<th>${h}</th>`).join("");
      const rows = (block.rows||[]).map(r=>`<tr>${(r.cells||[]).map(c=>`<td>${c}</td>`).join("")}</tr>`).join("");
      return `<table><thead><tr>${hdrs}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    default: return `<p>${s(block.text||"")}</p>`;
  }
}
// Serialize a block to markdown-like plain text.
function serializeBlockToText(block) {
  const plain = (t) => (window.stripHtml ? window.stripHtml(t||"") : (t||"").replace(/<[^>]*>/g,""));
  switch (block.type) {
    case "heading":  return `${"#".repeat(block.level||1)} ${plain(block.text)}`;
    case "text":     return plain(block.text);
    case "callout":  return `> ${plain(block.text)}`;
    case "divider":  return "---";
    case "bullets":  return (block.items||[]).map(i=>`- ${plain(i.text)}`).join("\n");
    case "numbers":  return (block.items||[]).map((i,n)=>`${n+1}. ${plain(i.text)}`).join("\n");
    case "checklist":return (block.items||[]).map(i=>`- [${i.done?"x":" "}] ${plain(i.text)}`).join("\n");
    case "table": {
      const hdrs = `| ${(block.headers||[]).join(" | ")} |`;
      const sep  = `| ${(block.headers||[]).map(()=>"---").join(" | ")} |`;
      const rows = (block.rows||[]).map(r=>`| ${(r.cells||[]).join(" | ")} |`);
      return [hdrs, sep, ...rows].join("\n");
    }
    case "kpis":
      return (block.items||[]).map(i=>`${plain(i.label)}: ${plain(i.value)}${i.unit||""}${i.target?" / "+i.target+(i.unit||""):""}`).join("\n");
    case "progress":
      return `${plain(block.label)}: ${block.value}/${block.total}`;
    default: return plain(block.text||"");
  }
}
window.serializeBlockToHtml = serializeBlockToHtml;
window.serializeBlockToText = serializeBlockToText;

function parseMarkdownishBlocks(text = "") {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    const body = paragraph.join("\n").trim();
    paragraph = [];
    if (body) blocks.push({ id: nid(), type:"text", text: parseInlineMd(body).replace(/\n/g, "<br>") });
  };

  const isTableLine = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isDividerLine = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  const cleanCell = (cell) => cell.trim().replace(/^\*\*(.*)\*\*$/, "$1");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (isDividerLine(trimmed)) {
      flushParagraph();
      blocks.push({ id: nid(), type:"divider" });
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ id: nid(), type:"heading", level: heading[1].length, text: parseInlineMd(heading[2].trim()) });
      continue;
    }

    if (isTableLine(line)) {
      flushParagraph();
      const tableLines = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;
      const parsedRows = tableLines.map((row) => row.trim().replace(/^\||\|$/g, "").split("|").map(cleanCell));
      const usefulRows = parsedRows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell.trim())));
      if (usefulRows.length) {
        const headers = usefulRows[0];
        const rows = usefulRows.slice(1).map((cells) => ({ id: nid(), cells }));
        blocks.push({ id: nid(), type:"table", headers, rows: rows.length ? rows : [{ id: nid(), cells: headers.map(() => "") }] });
      }
      continue;
    }

    const checklistItems = [];
    let j = i;
    while (j < lines.length) {
      const match = lines[j].trim().match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
      if (!match) break;
      checklistItems.push({ id: nid(), text: parseInlineMd(match[2].trim()), done: match[1].toLowerCase() === "x", dueDate:"" });
      j++;
    }
    if (checklistItems.length) {
      flushParagraph();
      blocks.push({ id: nid(), type:"checklist", items: checklistItems });
      i = j - 1;
      continue;
    }

    const bulletItems = [];
    j = i;
    while (j < lines.length) {
      const match = lines[j].trim().match(/^(?:[-*•])\s+(.+)$/);
      if (!match || /^[-*]\s+\[[ xX]\]\s+/.test(lines[j].trim())) break;
      bulletItems.push({ id: nid(), text: parseInlineMd(match[1].trim()) });
      j++;
    }
    if (bulletItems.length) {
      flushParagraph();
      blocks.push({ id: nid(), type:"bullets", items: bulletItems });
      i = j - 1;
      continue;
    }

    const numberItems = [];
    j = i;
    while (j < lines.length) {
      const match = lines[j].trim().match(/^\d+[.)]\s+(.+)$/);
      if (!match) break;
      numberItems.push({ id: nid(), text: parseInlineMd(match[1].trim()) });
      j++;
    }
    if (numberItems.length) {
      flushParagraph();
      blocks.push({ id: nid(), type:"numbers", items: numberItems });
      i = j - 1;
      continue;
    }

    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      blocks.push({ id: nid(), type:"callout", icon:"💡", text: parseInlineMd(quote[1].trim()) });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks.length ? blocks : [{ id: nid(), type:"text", text: htmlEscape(text) }];
}
window.parseMarkdownishBlocks = parseMarkdownishBlocks;

function isCursorAtStart(el) {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return false;
  const range = sel.getRangeAt(0);
  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().replace(/\u200B/g, "").length === 0;
}

function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0);
  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  // Strip zero-width spaces so cursor at visual position 0 always returns 0
  return before.toString().replace(/​/g, "").length;
}

function setCaretOffset(el, offset) {
  if (offset == null) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent.length;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, remaining));
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ====== EDITABLE TEXT ======
// Single contentEditable with slash-command support and B/I/U via execCommand
function EditableText({
  value, onChange, placeholder, multiline = false, style, tag = "div",
  onSlashCommand, onEnter, onBackspaceEmpty, onBackspaceAtStart, onMarkdownShortcut, autoFocus = false,
  softBreakOnEnter = false, focusKey = 0, onPasteBlocks, onTab, onShiftTab, selectOnFocus = false,
}) {
  const ref = useRef(null);
  const lastValue = useRef(sanitizeHtml(value || ""));
  const skipUpdate = useRef(false);
  const slashActiveRef = useRef(false);

  // Sync external value changes (undo/redo, remote edits) into the DOM.
  // Key invariant: handleInput sets lastValue = whatever the user just typed.
  // So if safeValue !== lastValue, the change came from outside (undo, redo, remote)
  // and we must push it to the DOM even while the field is focused.
  useEffect(() => {
    const safeValue = sanitizeHtml(value || "");
    if (!ref.current) return;

    // DOM already matches — nothing to do.
    if (ref.current.innerHTML === safeValue) {
      skipUpdate.current = false;
      return;
    }

    // This render was triggered by the user's own keystroke (handleInput set skipUpdate).
    // The DOM already has the right content; React just caught up. Skip.
    // BUT: if safeValue differs from what handleInput last wrote, it's a genuine
    // external update (e.g. a merge) and we must apply it even if skipUpdate is set.
    if (skipUpdate.current && safeValue === lastValue.current) {
      skipUpdate.current = false;
      return;
    }
    skipUpdate.current = false;

    // External update (undo, redo, remote change) — force the DOM to match.
    const wasFocused = document.activeElement === ref.current;
    ref.current.innerHTML = safeValue;
    lastValue.current = safeValue;

    // Restore cursor to end so the field stays usable after undo/redo.
    if (wasFocused) {
      try {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
    }
  }, [value]);

  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    ref.current.focus();
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(false); // cursor at end
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [autoFocus, focusKey]);

  const handleInput = () => {
    skipUpdate.current = true;
    const raw = ref.current.innerHTML;
    // Only run full sanitise when the browser has injected block-level tags
    // (avoids expensive DOM work on every plain-text keystroke)
    const needsSanitize = raw.includes("<div") || raw.includes("<p>") || raw.includes("<p ") || raw.includes("<span");
    const html = needsSanitize ? sanitizeHtml(raw) : raw;
    if (html !== raw) {
      const caret = getCaretOffset(ref.current);
      ref.current.innerHTML = html;
      setCaretOffset(ref.current, caret);
    }
    if (html !== lastValue.current) {
      lastValue.current = html;
      onChange(html);
    }
    if (onSlashCommand) {
      const txt = ref.current.innerText || "";
      const isSlash = txt.startsWith("/");
      if (isSlash) {
        slashActiveRef.current = true;
        onSlashCommand(txt, ref.current);
      } else if (slashActiveRef.current) {
        slashActiveRef.current = false;
        onSlashCommand(null, ref.current);
      }
    }
  };

  const handleKeyDown = (e) => {
    // Bold / Italic / Underline
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === "b") { e.preventDefault(); document.execCommand("bold"); handleInput(); return; }
      if (e.key === "i") { e.preventDefault(); document.execCommand("italic"); handleInput(); return; }
      if (e.key === "u") { e.preventDefault(); document.execCommand("underline"); handleInput(); return; }
    }
    if (e.key === " ") {
      // Commit a history snapshot at word boundaries (space) so undo works per-word
      if (window.__onWordBoundary) window.__onWordBoundary();
      if (onMarkdownShortcut) {
        const txt = (ref.current.innerText || "").replace(/\u200B/g, "").trim();
        if (txt === "-") {
          e.preventDefault();
          e.stopPropagation();
          onMarkdownShortcut("bullets");
          return;
        }
        if (txt === "1.") {
          e.preventDefault();
          e.stopPropagation();
          onMarkdownShortcut("numbers");
          return;
        }
      }
    }
    if (e.key === "Tab") {
      if (e.shiftKey && onShiftTab) {
        e.preventDefault();
        e.stopPropagation();
        onShiftTab();
        return;
      }
      if (!e.shiftKey && onTab) {
        e.preventDefault();
        e.stopPropagation();
        onTab();
        return;
      }
    }
    if (e.key === "Enter") {
      if ((e.shiftKey || softBreakOnEnter) && multiline) {
        e.preventDefault();
        e.stopPropagation();
        insertSoftBreakAtCursor();
        handleInput();
        return;
      }
      if (onEnter && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (window.__onWordBoundary) window.__onWordBoundary();
        const caretPos = getCaretOffset(ref.current);
        onEnter(ref.current.innerText || "", caretPos);
        return;
      }
      if (!multiline) {
        e.preventDefault();
        e.stopPropagation();
        ref.current.blur();
      }
    }
    if ((e.key === "Backspace" || e.key === "Delete") && onBackspaceEmpty) {
      const txt = ref.current.innerText.replace(/\u200B/g, "") || "";
      // If everything is selected, treat it as deleting the whole block
      const sel = window.getSelection();
      const allSelected = sel && !sel.isCollapsed
        && ref.current.contains(sel.anchorNode)
        && sel.toString().replace(/\u200B/g, "").replace(/\s/g, "") === txt.replace(/\s/g, "");
      if (isBlankText(ref.current.innerHTML) || txt.trim() === "" || allSelected) {
        e.preventDefault();
        e.stopPropagation();
        onBackspaceEmpty();
        return;
      }
      if (e.key === "Backspace" && onBackspaceAtStart && isCursorAtStart(ref.current)) {
        e.preventDefault();
        e.stopPropagation();
        onBackspaceAtStart(ref.current.innerHTML || "");
      }
    }
  };

  const handleBlur = () => {
    // Sync on blur
    skipUpdate.current = true;
    const html = sanitizeHtml(ref.current.innerHTML);
    if (html !== ref.current.innerHTML) {
      const caret = getCaretOffset(ref.current);
      ref.current.innerHTML = html;
      setCaretOffset(ref.current, caret);
    }
    if (html !== lastValue.current) {
      lastValue.current = html;
      onChange(html);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") || "";
    const clipHtml = e.clipboardData?.getData("text/html") || "";

    // ── Multi-block paste ──────────────────────────────────────────────────
    if (onPasteBlocks) {
      // Prefer HTML clipboard (Notion, Google Docs, Word) — it has real structure
      if (clipHtml) {
        const blocks = parseHtmlBlocks(clipHtml);
        // Only use HTML path if we got meaningful blocks (not just 1 empty text)
        const useful = blocks.filter(b => {
          if (b.type === "text") return (b.text || "").trim().length > 0;
          if (b.type === "bullets" || b.type === "numbers" || b.type === "checklist")
            return (b.items || []).some(i => (i.text || "").trim().length > 0);
          return true;
        });
        if (useful.length) {
          onPasteBlocks(useful, useful[0]?.id);
          return;
        }
      }
      // Fall back to plain-text / markdown parsing
      if (text.includes("\n") || /^(#{1,3}|[-*•]\s|\d+[.)]\s|>\s|\|)/m.test(text.trim())) {
        const blocks = parseMarkdownishBlocks(text);
        onPasteBlocks(blocks, blocks[0]?.id);
        return;
      }
    }

    // ── Single-line paste: preserve inline formatting from HTML ────────────
    if (clipHtml && !text.includes("\n")) {
      const match = clipHtml.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/);
      const fragment = match ? match[1] : clipHtml;
      const clean = sanitizeHtml(fragment);
      const plainEquiv = clean.replace(/<br\s*\/?>/gi, "").replace(/<[^>]*>/g, "");
      if (clean !== plainEquiv) {
        document.execCommand("insertHTML", false, clean);
        handleInput();
        return;
      }
    }
    insertTextAtCursor(text);
    handleInput();
  };

  const handleFocus = selectOnFocus ? () => {
    requestAnimationFrame(() => {
      if (!ref.current) return;
      try {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
    });
  } : undefined;

  const Tag = tag;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      data-placeholder={placeholder || ""}
      className="editable"
      style={{ whiteSpace:"pre-wrap", ...style }}
      spellCheck={false}
    />
  );
}
window.EditableText = EditableText;

// ====== SLASH MENU ======
// Available commands (the slash menu)
const SLASH_COMMANDS = [
  { keys:["h1","heading 1"],   label:"Heading 1",   icon:"H1", make: () => ({ id: nid(), type:"heading", level:1, text:"" }) },
  { keys:["h2","heading 2"],   label:"Heading 2",   icon:"H2", make: () => ({ id: nid(), type:"heading", level:2, text:"" }) },
  { keys:["h3","heading 3"],   label:"Heading 3",   icon:"H3", make: () => ({ id: nid(), type:"heading", level:3, text:"" }) },
  { keys:["text","p"],         label:"Text",        icon:"¶",  make: () => ({ id: nid(), type:"text", text:"" }) },
  { keys:["bullet","ul","list"], label:"Bulleted list", icon:"•", make: () => ({ id: nid(), type:"bullets", items:[{ id: nid(), text:"" }] }) },
  { keys:["numbers","ol","numbered"], label:"Numbered list", icon:"1.", make: () => ({ id: nid(), type:"numbers", items:[{ id: nid(), text:"" }] }) },
  { keys:["tasklist","todo","task","check","checklist"], label:"To-do list", icon:"☐", make: () => ({ id: nid(), type:"checklist", items:[{ id: nid(), text:"", done:false, dueDate:"" }] }) },
  { keys:["kpi","kpis","metric","dashboard"], label:"KPI dashboard", icon:"📊", make: () => ({ id: nid(), type:"kpis", items:[{ id: nid(), label:"Metric", value:"0", target:"", unit:"", change:"" }] }) },
  { keys:["progress","bar","prog"], label:"Progress bar", icon:"▰", make: () => ({ id: nid(), type:"progress", label:"Progress", value:0, total:100, color:"accent" }) },
  { keys:["milestone","milestones"], label:"Milestones", icon:"🎯", make: () => ({ id: nid(), type:"milestones", items:[{ id: nid(), name:"", status:"pending" }] }) },
  { keys:["table","tbl"], label:"Table", icon:"▦", make: () => ({ id: nid(), type:"table", headers:["Col 1","Col 2","Col 3"], rows:[{ id: nid(), cells:["","",""] }] }) },
  { keys:["calendar","cal"], label:"Calendar", icon:"Cal", make: () => ({ id: nid(), type:"calendar", month:"" }) },
  { keys:["callout","quote"], label:"Callout", icon:"💡", make: () => ({ id: nid(), type:"callout", icon:"💡", text:"" }) },
  { keys:["divider","hr","line"], label:"Divider", icon:"—", make: () => ({ id: nid(), type:"divider" }) },
];

const TRAILING_TEXT_BLOCK_TYPES = new Set(["callout", "table", "divider", "milestones", "kpis", "calendar", "progress"]);
function blockNeedsTrailingText(type) {
  return TRAILING_TEXT_BLOCK_TYPES.has(type);
}
window.blockNeedsTrailingText = blockNeedsTrailingText;

function matchSlashCommand(query) {
  const q = (query || "").toLowerCase().replace(/^\//, "").trim();
  if (!q) return SLASH_COMMANDS[0];
  return SLASH_COMMANDS.find(c => (
    c.keys.some(k => k.startsWith(q)) || c.label.toLowerCase().includes(q)
  ));
}
window.matchSlashCommand = matchSlashCommand;

function SlashMenu({ query, onPick, onClose, anchorRect }) {
  const [active, setActive] = useState(0);
  const filtered = SLASH_COMMANDS.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase().replace(/^\//, "");
    return c.keys.some(k => k.startsWith(q)) || c.label.toLowerCase().includes(q);
  });

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setActive(a => Math.max(a - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (filtered[active]) onPick(filtered[active]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [filtered, active, onPick, onClose]);

  if (filtered.length === 0) return null;
  // Use viewport-relative coordinates + position:fixed so the menu
  // is never clipped by the scrollable page-main container.
  const top = (anchorRect?.bottom || 0) + 4;
  const left = (anchorRect?.left || 0);
  return (
    <div className="slash-menu" style={{ top, left, position: "fixed" }}>
      <div className="slash-hint">Insert block</div>
      {filtered.map((c, i) => (
        <button
          key={c.label}
          onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
          onMouseEnter={() => setActive(i)}
          className={`slash-item ${i === active ? "active" : ""}`}
        >
          <span className="slash-icon">{c.icon}</span>
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}
window.SlashMenu = SlashMenu;

function isBlankText(value) {
  return window.stripHtml(value || "").replace(/\u200B/g, "").trim() === "";
}

function withItemInserted(items, afterId, newItem) {
  const index = items.findIndex((item) => item.id === afterId);
  const next = [...items];
  next.splice(index === -1 ? next.length : index + 1, 0, newItem);
  return next;
}

function liftListItemToTextBlocks(block, itemId, text, textIndentLevel = 0) {
  const index = (block.items || []).findIndex((item) => item.id === itemId);
  const level = Math.max(0, Math.min(MAX_LIST_LEVEL, Number(textIndentLevel) || 0));
  const textBlock = { id: nid(), type:"text", text: text || "", ...(level ? { textIndentLevel: level } : {}) };
  if (index === -1) return { blocks: [block], focusId: block.id };

  const beforeItems = block.items.slice(0, index);
  const afterItems = block.items.slice(index + 1);
  const blocks = [];
  if (beforeItems.length) blocks.push({ ...block, items: beforeItems });
  blocks.push(textBlock);
  if (afterItems.length) blocks.push({ ...block, id: nid(), items: afterItems });
  return { blocks, focusId: textBlock.id };
}

const MAX_LIST_LEVEL = 2;
const listLevel = (item) => Math.max(0, Math.min(MAX_LIST_LEVEL, Number(item?.level ?? (item?.indent ? 1 : 0)) || 0));
const markerForNumberLevel = (level, ordinal) => {
  if (level === 1) return `${String.fromCharCode(96 + ordinal)}.`;
  if (level >= 2) {
    const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
    return `${romans[(ordinal - 1) % romans.length]}.`;
  }
  return `${ordinal}.`;
};
const markerForBulletLevel = (level) => ["•", "◦", "▪"][Math.min(MAX_LIST_LEVEL, level)] || "•";
const itemWithLevel = (item) => {
  const { indent, level: _level, ...rest } = item;
  const level = listLevel(item);
  return level ? { ...rest, level } : rest;
};
const textIndentLevel = (block) => Math.max(0, Math.min(MAX_LIST_LEVEL, Number(block?.textIndentLevel) || 0));

function localDateValue(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateText) {
  if (!dateText) return null;
  const target = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function formatDateLabel(dateText) {
  if (!dateText) return "No date";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}

function categoryStyle(category) {
  if (!category) return { bg:"rgba(120,120,120,0.18)", text:"#aaa" };
  if (window.CATEGORY_COLORS?.[category]) return window.CATEGORY_COLORS[category];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = ((hash << 5) - hash) + category.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsla(${hue}, 58%, 46%, 0.18)`,
    text: `hsl(${hue}, 68%, 72%)`,
  };
}
window.categoryStyle = categoryStyle;

function BlockDeleteButton({ onDeleteBlock, title = "Delete block" }) {
  if (!onDeleteBlock) return null;
  return (
    <button
      className="block-delete-btn"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteBlock(); }}
      title={title}
      type="button"
    >
      ×
    </button>
  );
}

// ====== BLOCK HANDLE ======
function BlockHandle({ blockId, onDragBlockStart, onDragBlockEnd }) {
  return (
    <button
      className="block-handle"
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", blockId);
        onDragBlockStart?.(blockId);
      }}
      onDragEnd={onDragBlockEnd}
      title="Move block"
      type="button"
    >
      ⋮⋮
    </button>
  );
}

// ====== TEXT BLOCK with slash detection ======
function TextBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onAddBlockBefore, onAddBlockAfter, onMarkdownShortcut, onSlashCommandShow, onSlashCommandHide, onReplaceBlock, isLast, autoFocus, focusKey = 0 }) {
  const ref = useRef(null);
  const indentLevel = textIndentLevel(block);
  const handleSlash = (txt, el) => {
    if (txt && txt.startsWith("/")) {
      // Prefer the live cursor rect so the menu pops up right below the /
      // rather than at the top-left of the block element.
      const sel = window.getSelection();
      let rect = el.getBoundingClientRect();
      if (sel && sel.rangeCount > 0) {
        const cr = sel.getRangeAt(0).getBoundingClientRect();
        if (cr.height > 0) rect = cr;
      }
      onSlashCommandShow(txt, rect, () => {
        updateBlock({ ...block, text: "" });
      }, el);
    } else {
      onSlashCommandHide();
    }
  };
  const stepBackIndent = () => {
    if (indentLevel <= 0) return false;
    const nextLevel = indentLevel - 1;
    const { textIndentLevel: _old, ...rest } = block;
    updateBlock(nextLevel ? { ...rest, textIndentLevel: nextLevel } : rest);
    return true;
  };
  return (
    <div className={`block-wrap text-indent-level-${indentLevel}`}>
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <EditableText
        value={block.text}
        onChange={(v) => updateBlock({ ...block, text: v })}
        placeholder={isLast ? "Type '/' for commands, or just start writing..." : ""}
        multiline
        onSlashCommand={handleSlash}
        onEnter={(plainText, caretPos) => {
          const txt = (plainText || "").trim();
          if (txt.startsWith("/")) {
            const cmd = window.matchSlashCommand(txt);
          if (cmd) {
              const nextBlock = { ...cmd.make(), id: block.id };
              if (blockNeedsTrailingText(nextBlock.type) && onReplaceBlock) {
                const textBlock = { id: nid(), type:"text", text:"" };
                onReplaceBlock([nextBlock, textBlock], textBlock.id);
              } else {
                updateBlock(nextBlock);
              }
              onSlashCommandHide();
              return;
            }
          }
          if (caretPos === 0 && txt.length > 0) {
            onAddBlockBefore?.();
          } else {
            onAddBlockAfter();
          }
        }}
        onBackspaceEmpty={() => {
          if (stepBackIndent()) return;
          onDeleteEmpty?.();
        }}
        onBackspaceAtStart={() => {
          stepBackIndent();
        }}
        onMarkdownShortcut={onMarkdownShortcut}
        onPasteBlocks={(blocks, focusId) => onReplaceBlock?.(blocks, focusId)}
        autoFocus={autoFocus}
        focusKey={focusKey}
        style={{ fontSize:16, color:"var(--text)", lineHeight:1.55, margin:"3px 0", minHeight:24 }}
      />
    </div>
  );
}

// ====== HEADING BLOCK ======
function HeadingBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onConvertToText, onAddBlockAfter, autoFocus, focusKey = 0 }) {
  const sizes = { 1:30, 2:24, 3:19 };
  const weights = { 1:700, 2:600, 3:600 };
  const margins = { 1:"30px 0 8px", 2:"22px 0 6px", 3:"14px 0 4px" };
  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <EditableText
        value={block.text}
        onChange={(v) => updateBlock({ ...block, text: v })}
        placeholder={`Heading ${block.level}`}
        onEnter={(_, caretPos) => caretPos === 0 && !isBlankText(block.text) ? onAddBlockBefore?.() : onAddBlockAfter()}
        onBackspaceEmpty={() => isBlankText(block.text) ? onConvertToText?.("") : onDeleteEmpty?.()}
        onBackspaceAtStart={() => onConvertToText?.(block.text || "")}
        autoFocus={autoFocus}
        focusKey={focusKey}
        style={{
          fontSize: sizes[block.level],
          fontWeight: weights[block.level],
          color:"var(--text-strong)",
          margin: margins[block.level],
          lineHeight: 1.3,
          letterSpacing: 0,
        }}
      />
    </div>
  );
}

// ====== CALLOUT ======
function CalloutBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onDeleteBlock, onReplaceBlock, onConvertToText }) {
  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      <div className="callout">
        <EditableText
          value={block.icon}
          onChange={(v) => updateBlock({ ...block, icon: v })}
          style={{ fontSize:20, minWidth:24, marginTop:2 }}
        />
        <EditableText
          value={block.text}
          onChange={(v) => updateBlock({ ...block, text: v })}
          placeholder="Callout text..."
          multiline
          softBreakOnEnter
          onBackspaceEmpty={() => onConvertToText?.("")}
          onBackspaceAtStart={() => onConvertToText?.(block.text || "")}
          style={{ flex:1, fontSize:15, lineHeight:1.55, color:"var(--text)" }}
          onPasteBlocks={(pastedBlocks) => {
            // Paste plain text into callout — join lines with soft breaks instead of splitting into blocks
            const joined = pastedBlocks.map(b => {
              if (b.type === "text" || b.type === "heading") return window.stripHtml ? window.stripHtml(b.text || "") : (b.text || "");
              if (b.type === "bullets" || b.type === "numbers") return (b.items || []).map(i => window.stripHtml ? window.stripHtml(i.text || "") : (i.text || "")).join("\n");
              return "";
            }).filter(Boolean).join("\n");
            const sanitized = window.sanitizeHtml ? window.sanitizeHtml(joined.replace(/\n/g, "<br>")) : joined;
            const current = block.text || "";
            updateBlock({ ...block, text: current ? current + "<br>" + sanitized : sanitized });
          }}
        />
      </div>
    </div>
  );
}

// ====== BULLETS ======
function BulletsBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onConvertToText, onReplaceBlock, onAddBlockAfter, onExitBlock, autoFocus }) {
  const [focusItemId, setFocusItemId] = useState(null);
  const [focusKey, setFocusKey] = useState(0);
  // Pre-focus an item BEFORE the DOM mutation so focus is never lost when
  // the current element is removed from the tree.
  const preFocusEl = (itemId, atStart = false) => {
    const row = document.querySelector(`[data-item-id="${itemId}"]`);
    const el = row?.querySelector('.editable');
    if (!el) return;
    el.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(atStart);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (_) {}
  };
  const upd = (id, patch) => updateBlock({ ...block, items: block.items.map(i => i.id === id ? itemWithLevel({ ...i, ...(typeof patch === "string" ? { text:patch } : patch) }) : itemWithLevel(i)) });
  const addAfter = (id, level = 0) => {
    const newItem = itemWithLevel({ id: nid(), text:"", level });
    updateBlock({ ...block, items: withItemInserted(block.items, id, newItem) });
    setFocusItemId(newItem.id);
  };
  const addBefore = (id) => {
    const idx = block.items.findIndex(i => i.id === id);
    // Create a new item with same level as current item
    const currentLevel = listLevel(block.items[idx]);
    const newItem = itemWithLevel({
      id: nid(),
      text: "",
      level: currentLevel,
      // Ensure it's plain text (no formatting)
    });
    const next = [...block.items];
    // Insert at current index (pushes current item down)
    next.splice(Math.max(0, idx), 0, newItem);
    updateBlock({ ...block, items: next.map(itemWithLevel) });
    setFocusItemId(newItem.id);
    // Force focus to new item at start of text
    setTimeout(() => {
      const row = document.querySelector(`[data-item-id="${newItem.id}"]`);
      const el = row?.querySelector('.editable');
      if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  };
  const exitList = (id) => {
    const next = block.items.filter(i => i.id !== id && !isBlankText(i.text));
    onExitBlock?.({ ...block, items: next });
  };
  const rem = (id) => {
    // Filter out the deleted item AND any empty default items
    const next = block.items.filter(i => {
      if (i.id === id) return false; // Remove the item user clicked delete on
      // Also remove any completely empty items (default/unused)
      const isEmpty = !i.text || i.text.trim() === "";
      if (isEmpty && block.items.filter(x => !x.text?.trim()).length > 1) {
        return false; // Remove if there are multiple empty items
      }
      return true;
    });
    // Never leave the list completely empty - keep at least one blank item
    const itemsToSave = next.length > 0 ? next : [{ id: nid(), text: "", level: 0 }];
    updateBlock({ ...block, items: itemsToSave });
  };
  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <div className="list-block">
        {block.items.map((item, index) => {
          const level = listLevel(item);
          return (
          <div key={item.id} data-item-id={item.id} className={`list-row list-level-${level}`}>
            <span className="bullet-dot">{markerForBulletLevel(level)}</span>
            <EditableText
              value={item.text}
              onChange={(v) => upd(item.id, v)}
              placeholder="List item"
              multiline
              autoFocus={focusItemId === item.id || (autoFocus && index === 0)}
              focusKey={focusItemId === item.id ? focusKey : 0}
              onEnter={(_, caretPos) => {
                if (isBlankText(item.text)) {
                  if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                  const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                  onReplaceBlock?.(lifted.blocks, lifted.focusId);
                  return;
                }
                if (caretPos === 0) return addBefore(item.id);
                addAfter(item.id, level);
              }}
              onTab={() => upd(item.id, { level: Math.min(MAX_LIST_LEVEL, level + 1) })}
              onShiftTab={() => upd(item.id, { level: Math.max(0, level - 1) })}
              onBackspaceEmpty={() => {
                if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                // level 0, empty: pre-focus prev then remove this item — focus never leaves the list
                if (index > 0) {
                  const prevItem = block.items[index - 1];
                  preFocusEl(prevItem.id, false); // focus prev at end BEFORE DOM mutation
                  updateBlock({ ...block, items: block.items.filter(i => i.id !== item.id) });
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              onBackspaceAtStart={() => {
                if (level > 0) {
                  // Cursor naturally stays at start (element stays in DOM, text unchanged)
                  upd(item.id, { level: level - 1 });
                  return;
                }
                if (index > 0) {
                  const prevItem = block.items[index - 1];
                  const mergedText = prevItem.text + item.text;
                  preFocusEl(prevItem.id, false); // pre-focus at end BEFORE DOM mutation
                  const newItems = block.items
                    .map(i => i.id === prevItem.id ? { ...i, text: mergedText } : i)
                    .filter(i => i.id !== item.id);
                  updateBlock({ ...block, items: newItems });
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, item.text);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              style={{ flex:1, fontSize:15, lineHeight:1.55, padding:"2px 0", color:"var(--text)" }}
            />
            <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); rem(item.id); }} className="row-del" type="button">×</button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ====== NUMBERED LIST ======
function NumbersBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onConvertToText, onReplaceBlock, onAddBlockAfter, onExitBlock, autoFocus }) {
  const [focusItemId, setFocusItemId] = useState(null);
  const [focusKey, setFocusKey] = useState(0);
  const preFocusEl = (itemId, atStart = false) => {
    const row = document.querySelector(`[data-item-id="${itemId}"]`);
    const el = row?.querySelector('.editable');
    if (!el) return;
    el.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(atStart);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (_) {}
  };
  const upd = (id, patch) => updateBlock({ ...block, items: block.items.map(i => i.id === id ? itemWithLevel({ ...i, ...(typeof patch === "string" ? { text:patch } : patch) }) : itemWithLevel(i)) });
  const addAfter = (id, level = 0) => {
    const newItem = itemWithLevel({ id: nid(), text:"", level });
    updateBlock({ ...block, items: withItemInserted(block.items, id, newItem) });
    setFocusItemId(newItem.id);
    setFocusKey((key) => key + 1);
  };
  const addBefore = (id) => {
    const idx = block.items.findIndex(i => i.id === id);
    // Create a new item with same level as current item
    const currentLevel = listLevel(block.items[idx]);
    const newItem = itemWithLevel({
      id: nid(),
      text: "",
      level: currentLevel,
      // Ensure it's plain text (no formatting)
    });
    const next = [...block.items];
    // Insert at current index (pushes current item down)
    next.splice(Math.max(0, idx), 0, newItem);
    updateBlock({ ...block, items: next.map(itemWithLevel) });
    setFocusItemId(newItem.id);
    setFocusKey((key) => key + 1);
    // Force focus to new item at start of text
    setTimeout(() => {
      const row = document.querySelector(`[data-item-id="${newItem.id}"]`);
      const el = row?.querySelector('.editable');
      if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  };
  const exitList = (id) => {
    const next = block.items.filter(i => i.id !== id && !isBlankText(i.text));
    onExitBlock?.({ ...block, items: next });
  };
  const rem = (id, idx) => {
    // Filter out the deleted item AND any empty default items
    const next = block.items.filter(i => {
      if (i.id === id) return false; // Remove the item user clicked delete on
      // Also remove any completely empty items (default/unused)
      const isEmpty = !i.text || i.text.trim() === "";
      if (isEmpty && block.items.filter(x => !x.text?.trim()).length > 1) {
        return false; // Remove if there are multiple empty items
      }
      return true;
    });
    // Never leave the list completely empty - keep at least one blank item
    const itemsToSave = next.length > 0 ? next : [{ id: nid(), text: "", level: 0 }];
    updateBlock({ ...block, items: itemsToSave });
    const focusTarget = itemsToSave[Math.max(0, idx - 1)] || itemsToSave[0];
    if (focusTarget) {
      setFocusItemId(focusTarget.id);
      setFocusKey((key) => key + 1);
    }
  };
  // Compute ordinals: count consecutive siblings at the same level under the same parent.
  // Parent boundary = the most recent item at (level - 1). Switching parents resets the count.
  const ordinals = (() => {
    // Track last-seen index of each parent level so we can detect parent changes.
    // parentId[l] = the flat index of the most recent item at level l-1 (i.e. the parent of items at level l).
    // counter[l] = running count of items at level l under the current parent.
    const counter = [0, 0, 0];
    const parentIdx = [-1, -1, -1]; // index of the most-recent item at level l-1
    return block.items.map((item, idx) => {
      const lv = listLevel(item);
      // Find the most recent item above idx at level lv-1 (= parent level).
      // If that parent has changed since we last counted, reset the counter for lv.
      if (lv > 0) {
        let newParentIdx = -1;
        for (let k = idx - 1; k >= 0; k--) {
          if (listLevel(block.items[k]) === lv - 1) { newParentIdx = k; break; }
        }
        if (newParentIdx !== parentIdx[lv]) {
          counter[lv] = 0;
          parentIdx[lv] = newParentIdx;
        }
      }
      counter[lv] += 1;
      // Reset counters for all deeper levels when we encounter this level.
      for (let i = lv + 1; i < counter.length; i++) { counter[i] = 0; parentIdx[i] = -1; }
      return counter[lv];
    });
  })();

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <div className="list-block">
        {block.items.map((item, idx) => {
          const level = listLevel(item);
          return (
          <div key={item.id} data-item-id={item.id} className={`list-row list-level-${level}`}>
            <span className="number-dot">
              {markerForNumberLevel(level, ordinals[idx])}
            </span>
            <EditableText
              value={item.text}
              onChange={(v) => upd(item.id, v)}
              placeholder={level ? "Sub-item" : "Numbered item"}
              multiline
              autoFocus={focusItemId === item.id || (autoFocus && idx === 0)}
              focusKey={focusItemId === item.id ? focusKey : 0}
              onEnter={(_, caretPos) => {
                if (isBlankText(item.text)) {
                  if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                  const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                  onReplaceBlock?.(lifted.blocks, lifted.focusId);
                  return;
                }
                if (caretPos === 0) return addBefore(item.id);
                addAfter(item.id, level);
              }}
              onTab={() => upd(item.id, { level: Math.min(MAX_LIST_LEVEL, level + 1) })}
              onShiftTab={() => upd(item.id, { level: Math.max(0, level - 1) })}
              onBackspaceEmpty={() => {
                if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                // level 0, empty: remove this item and go to end of previous
                if (idx > 0) {
                  const prevItem = block.items[idx - 1];
                  preFocusEl(prevItem.id, false);
                  updateBlock({ ...block, items: block.items.filter(i => i.id !== item.id) });
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              onBackspaceAtStart={() => {
                if (level > 0) {
                  upd(item.id, { level: level - 1 });
                  return;
                }
                if (idx > 0) {
                  const prevItem = block.items[idx - 1];
                  const mergedText = prevItem.text + item.text;
                  const newItems = block.items
                    .map(i => i.id === prevItem.id ? { ...i, text: mergedText } : i)
                    .filter(i => i.id !== item.id);
                  preFocusEl(prevItem.id, false);
                  updateBlock({ ...block, items: newItems });
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, item.text);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              style={{ flex:1, fontSize:15, lineHeight:1.55, padding:"2px 0", color:"var(--text)" }}
            />
            <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); rem(item.id, idx); }} className="row-del" type="button">×</button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ====== CHECKLIST ======
function ChecklistBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onConvertToText, onReplaceBlock, onAddBlockAfter, onAddBlockBefore, onExitBlock, autoFocus, data }) {
  const [focusItemId, setFocusItemId] = useState(null);
  const [tableView, setTableView] = useState(block.tableView || false);
  const upd = (id, patch) => updateBlock({ ...block, items: block.items.map(i => i.id === id ? { ...i, ...patch } : i) });
  const addAfter = (id) => {
    const newItem = { id: nid(), text:"", done:false, dueDate:"" };
    updateBlock({ ...block, items: withItemInserted(block.items, id, newItem) });
    setFocusItemId(newItem.id);
  };
  const appendTask = () => {
    const newItem = { id: nid(), text:"", done:false, dueDate:"" };
    updateBlock({ ...block, items: [...(block.items || []), newItem] });
    setFocusItemId(newItem.id);
  };
  const addBefore = (id) => {
    const idx = block.items.findIndex(i => i.id === id);
    const newItem = { id: nid(), text:"", done:false, dueDate:"" };
    const next = [...block.items];
    next.splice(Math.max(0, idx), 0, newItem);
    updateBlock({ ...block, items: next });
    setFocusItemId(newItem.id);
  };
  const exitList = (id) => {
    const next = block.items.filter(i => i.id !== id && !isBlankText(i.text));
    onExitBlock?.({ ...block, items: next });
  };
  const rem = (id) => updateBlock({ ...block, items: block.items.filter(i => i.id !== id) });
  const toggleView = () => {
    const next = !tableView;
    setTableView(next);
    updateBlock({ ...block, tableView: next });
  };

  const done = block.items.filter(i => i.done).length;
  const total = block.items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const today = new Date().toISOString().slice(0,10);

  const sortedItems = tableView ? [...block.items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return String(a.dueDate).localeCompare(String(b.dueDate));
  }) : block.items;

  const dueBadge = (dueDate, isDone) => {
    if (!dueDate) return null;
    if (isDone) return <span className="due-badge done-badge">✓ Done</span>;
    if (dueDate < today) return <span className="due-badge overdue-badge">Overdue</span>;
    if (dueDate === today) return <span className="due-badge today-badge">Today</span>;
    const days = Math.round((new Date(dueDate) - new Date(today)) / 86400000);
    return <span className="due-badge upcoming-badge">{days}d left</span>;
  };

  if (tableView) {
    return (
      <div className="block-wrap">
        <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
        <div className="checklist-table-wrap">
          <div className="checklist-table-toolbar">
            <div className="ct-progress-bar">
              <div className="ct-progress-fill" style={{ width:`${pct}%` }} />
            </div>
            <span className="checklist-table-count">{done}/{total} done · {pct}%</span>
            <button className="checklist-view-btn active" onClick={toggleView} title="Switch to list view">≡ List</button>
          </div>
          <table className="checklist-table">
            <thead>
              <tr>
                <th className="ct-col-check"></th>
                <th className="ct-col-task">Task</th>
                <th className="ct-col-date">Due Date</th>
                <th className="ct-col-status">Status</th>
                <th className="ct-col-del"></th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const isOverdue = item.dueDate && item.dueDate < today && !item.done;
                return (
                  <tr key={item.id} className={`ct-row ${item.done ? "ct-done" : ""} ${isOverdue ? "ct-overdue" : ""}`}>
                    <td className="ct-col-check">
                      <button
                        className="check-box"
                        onClick={() => upd(item.id, { done: !item.done })}
                        style={{ background: item.done ? "var(--accent)" : "transparent", borderColor: item.done ? "var(--accent)" : "rgba(255,255,255,0.32)" }}
                      >
                        {item.done && <span style={{ color:"#000", fontSize:11, fontWeight:700 }}>✓</span>}
                      </button>
                    </td>
                    <td className="ct-col-task">
                      <EditableText
                        value={item.text}
                        onChange={(v) => upd(item.id, { text: v })}
                        placeholder="Task name"
                        style={{ fontSize:13, textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--text-muted)" : "var(--text)" }}
                      />
                    </td>
                    <td className="ct-col-date">
                      <input
                        className="ct-date-input"
                        type="date"
                        value={item.dueDate || ""}
                        onInput={(e) => upd(item.id, { dueDate: e.target.value })}
                        onChange={(e) => upd(item.id, { dueDate: e.target.value })}
                      />
                    </td>
                    <td className="ct-col-status">
                      {dueBadge(item.dueDate, item.done) || <span className="due-badge pending-badge">{item.done ? "Done" : "Pending"}</span>}
                    </td>
                    <td className="ct-col-del">
                      <button onClick={() => rem(item.id)} className="row-del" type="button">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="add-row-btn" onClick={() => { const last = block.items[block.items.length - 1]; last ? addAfter(last.id) : appendTask(); }}>+ task</button>
        </div>
      </div>
    );
  }

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <div className="list-block">
        {total > 0 && (
          <div className="progress-row">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="progress-text">{done}/{total} · {pct}%</span>
            <button className="checklist-view-btn" onClick={toggleView} title="Switch to table view">⊞ Table</button>
          </div>
        )}
        {block.items.map((item, index) => (
          <div key={item.id} className={`check-row ${item.done ? "done" : ""}`}>
            <button
              className="check-box"
              onClick={() => upd(item.id, { done: !item.done })}
              style={{ background: item.done ? "var(--accent)" : "transparent", borderColor: item.done ? "var(--accent)" : "rgba(255,255,255,0.32)" }}
            >
              {item.done && <span style={{ color:"#000", fontSize:11, fontWeight:700 }}>✓</span>}
            </button>
            <div className="check-main">
              <EditableText
                value={item.text}
                onChange={(v) => upd(item.id, { text: v })}
                placeholder="To-do"
                multiline
                autoFocus={focusItemId === item.id || (autoFocus && index === 0)}
                onEnter={(_, caretPos) => {
                  if (isBlankText(item.text)) return block.items.length === 1 && index === 0 ? addAfter(item.id) : exitList(item.id);
                  if (caretPos === 0) return addBefore(item.id);
                  addAfter(item.id);
                }}
                onBackspaceEmpty={() => block.items.length > 1 ? rem(item.id) : onConvertToText?.("")}
                onBackspaceAtStart={() => {
                  const lifted = liftListItemToTextBlocks(block, item.id, item.text);
                  onReplaceBlock?.(lifted.blocks, lifted.focusId);
                }}
                style={{
                  fontSize:14, lineHeight:1.55,
                  textDecoration: item.done ? "line-through" : "none",
                  color: item.done ? "var(--text-muted)" : "var(--text)",
                }}
              />
            </div>
            <input
              className="ct-date-input ct-date-inline"
              type="date"
              value={item.dueDate || ""}
              onInput={(e) => upd(item.id, { dueDate: e.target.value })}
              onChange={(e) => upd(item.id, { dueDate: e.target.value })}
              title="Due date"
            />
            {item.dueDate && dueBadge(item.dueDate, item.done)}
            <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); rem(item.id); }} className="row-del" type="button">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ====== KPI CARDS ======
function KpisBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock, pageBlocks }) {
  const upd = (id, patch) => updateBlock({ ...block, items: block.items.map(i => i.id === id ? { ...i, ...patch } : i) });
  const add = () => updateBlock({ ...block, items: [...block.items, { id: nid(), label:"New Metric", value:"0", target:"", unit:"", change:"" }] });
  const rem = (id) => updateBlock({ ...block, items: block.items.filter(i => i.id !== id) });
  const metricNumber = (value) => {
    const raw = String(value || "").trim().toLowerCase().replace(/,/g, "");
    if (!raw) return 0;
    const match = raw.match(/-?\d*\.?\d+/);
    if (!match) return 0;
    const multiplier = raw.includes("m") ? 1000000 : raw.includes("k") ? 1000 : 1;
    return Number(match[0]) * multiplier;
  };

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      <div className="kpi-grid">
        {block.items.map(item => {
          const rawNum = metricNumber(item.value);
          const rawTotal = metricNumber(item.target);
          const displayTarget = item.target || "";
          const progress = rawTotal > 0 ? Math.min(100, (rawNum / rawTotal) * 100) : null;
          const progressColor = progress === null
            ? "var(--accent)"
            : progress >= 80 ? "var(--kpi-green)"
            : progress >= 40 ? "var(--kpi-amber)"
            : "var(--kpi-red)";

          return (
            <div key={item.id} className="kpi-card">
              <button onClick={() => rem(item.id)} className="kpi-del" title="Remove metric">×</button>

              <div className="kpi-label-row">
                <EditableText
                  value={item.label}
                  onChange={(v) => upd(item.id, { label: v })}
                  placeholder="METRIC NAME"
                  style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, flex:1 }}
                />
              </div>

              <div className="kpi-value-row">
                <EditableText
                  value={item.value}
                  onChange={(v) => upd(item.id, { value: v })}
                  placeholder="0"
                  style={{ fontSize:36, fontWeight:800, color: progressColor, lineHeight:1, letterSpacing:"-0.02em" }}
                />
                {item.unit && <span className="kpi-unit-badge">{item.unit}</span>}
              </div>

              {displayTarget && (
                <div className="kpi-target-label">
                  Target: <strong>{displayTarget}{item.unit}</strong>
                </div>
              )}

              {progress !== null && (
                <div className="kpi-progress-wrap">
                  <div className="kpi-progress-track">
                    <div className="kpi-progress-fill" style={{ width:`${progress}%`, background: progressColor }} />
                  </div>
                  <span className="kpi-progress-pct" style={{ color: progressColor }}>{Math.round(progress)}%</span>
                </div>
              )}

              <EditableText
                value={item.change || ""}
                onChange={(v) => upd(item.id, { change: v })}
                placeholder="Note, owner, or source..."
                style={{ fontSize:11, color:"var(--text-muted)", marginTop:8, display:"block" }}
              />

              <div className="kpi-config-panel">
                <label className="kpi-cfg-label">
                  <span>Target</span>
                  <input
                    className="kpi-cfg-input"
                    type="text"
                    placeholder="100"
                    value={item.target || ""}
                    onChange={(e) => upd(item.id, { target: e.target.value })}
                    title="Target value"
                  />
                </label>
                <label className="kpi-cfg-label">
                  <span>Unit</span>
                  <input
                    className="kpi-cfg-input kpi-cfg-unit"
                    type="text"
                    placeholder="RM"
                    value={item.unit || ""}
                    onChange={(e) => upd(item.id, { unit: e.target.value })}
                    title="Unit (%, RM, leads...)"
                  />
                </label>
              </div>
            </div>
          );
        })}
        <button onClick={add} className="kpi-add">
          <span className="kpi-add-icon">+</span>
          <span>Add metric</span>
        </button>
      </div>
    </div>
  );
}

// ====== MILESTONES ======
function MilestonesBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock, onExitBlock, autoFocus }) {
  const [focusItemId, setFocusItemId] = useState(null);
  const upd = (id, patch) => updateBlock({ ...block, items: block.items.map(i => i.id === id ? { ...i, ...patch } : i) });
  const add = () => {
    const item = { id: nid(), name:"", status:"pending" };
    updateBlock({ ...block, items: [...block.items, item] });
    setFocusItemId(item.id);
  };
  const addBefore = (id) => {
    const idx = block.items.findIndex(i => i.id === id);
    const newItem = { id: nid(), name:"", status:"pending" };
    const next = [...block.items];
    next.splice(Math.max(0, idx), 0, newItem);
    updateBlock({ ...block, items: next });
    setFocusItemId(newItem.id);
  };
  const rem = (id) => updateBlock({ ...block, items: block.items.filter(i => i.id !== id) });
  const exitMilestones = (id) => {
    const next = block.items.filter(i => i.id !== id && !isBlankText(i.name));
    onExitBlock?.({ ...block, items: next });
  };
  const onMilestoneEnter = (item, index, caretPos) => {
    if (isBlankText(item.name)) {
      if (block.items.length === 1 && index === 0) { add(); return; }
      exitMilestones(item.id);
      return;
    }
    if (caretPos === 0) { addBefore(item.id); return; }
    add();
  };
  const cycle = (id, cur) => {
    const next = cur === "pending" ? "active" : cur === "active" ? "done" : "pending";
    upd(id, { status: next });
  };
  const ST = {
    pending: { bg:"rgba(120,120,120,0.18)", text:"#aaa", label:"Not started" },
    active:  { bg:"rgba(212,160,23,0.15)",  text:"#e8c460", label:"In progress" },
    done:    { bg:"rgba(0,149,122,0.15)",   text:"#4dd4b0", label:"✓ Done" },
  };
  const totalMs = block.items.length;
  const doneMs  = block.items.filter(i => i.status === "done").length;
  const activeMs = block.items.filter(i => i.status === "active").length;
  const pctMs   = totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : 0;

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      {totalMs > 0 && (
        <div className="milestone-header">
          <div className="milestone-header-stats">
            <span className="milestone-stat done-stat">✓ {doneMs} done</span>
            {activeMs > 0 && <span className="milestone-stat active-stat">◑ {activeMs} in progress</span>}
            <span className="milestone-stat pending-stat">○ {totalMs - doneMs - activeMs} pending</span>
          </div>
          <div className="milestone-header-bar">
            <div className="milestone-header-fill" style={{ width:`${pctMs}%` }} />
          </div>
          <span className="milestone-header-pct">{pctMs}%</span>
        </div>
      )}
      <div className="milestone-list">
        {block.items.map((item, index) => {
          const s = ST[item.status] || ST.pending;
          return (
            <div key={item.id} className="milestone-row">
              <button onClick={() => cycle(item.id, item.status)}
                style={{ background:s.bg, color:s.text, fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:12, border:"none", cursor:"pointer", minWidth:96 }}>
                {s.label}
              </button>
              <EditableText
                value={item.name}
                onChange={(v) => upd(item.id, { name: v })}
                placeholder="Milestone"
                multiline
                autoFocus={focusItemId === item.id || (autoFocus && index === 0)}
                onEnter={(_, caretPos) => onMilestoneEnter(item, index, caretPos)}
                onBackspaceEmpty={() => block.items.length > 1 ? rem(item.id) : onExitBlock?.({ ...block, items: [] })}
                style={{ flex:1, fontSize:14, fontWeight:500, color:"var(--text)" }}
              />
              <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); rem(item.id); }} className="row-del" type="button">×</button>
            </div>
          );
        })}
        <button onClick={add} className="add-row-btn">+ milestone</button>
      </div>
    </div>
  );
}

// ====== TABLE ======
function TableBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock }) {
  const columnWidths = block.columnWidths || block.headers.map(() => 180);
  const updateTable = (patch) => updateBlock({ ...block, ...patch });
  const updCell = (rid, ci, v) => updateBlock({ ...block, rows: block.rows.map(r => r.id === rid ? { ...r, cells: r.cells.map((c,i) => i === ci ? v : c) } : r) });
  const updHead = (i, v) => updateBlock({ ...block, headers: block.headers.map((h, idx) => idx === i ? v : h) });
  const addRow = () => updateBlock({ ...block, columnWidths, rows: [...block.rows, { id: nid(), cells: block.headers.map(() => "") }] });
  const addCol = () => updateBlock({ ...block, headers: [...block.headers, "New"], columnWidths: [...columnWidths, 180], rows: block.rows.map(r => ({ ...r, cells: [...r.cells, ""] })) });
  const clearCell = (rid, ci) => updCell(rid, ci, "");
  const remRow = (id) => {
    const nextRows = block.rows.filter(r => r.id !== id);
    updateBlock({ ...block, rows: nextRows.length ? nextRows : [{ id: nid(), cells: block.headers.map(() => "") }] });
  };
  const remCol = (i) => {
    if (block.headers.length <= 1) return;
    updateBlock({ ...block, headers: block.headers.filter((_,idx) => idx !== i), columnWidths: columnWidths.filter((_, idx) => idx !== i), rows: block.rows.map(r => ({ ...r, cells: r.cells.filter((_,idx) => idx !== i) })) });
  };
  const startResize = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[index] || 180;
    const onMove = (ev) => {
      const nextWidths = [...columnWidths];
      nextWidths[index] = Math.max(80, startWidth + ev.clientX - startX);
      updateTable({ columnWidths: nextWidths });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
  };
  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      <div className="tbl-wrap">
        <table style={{ tableLayout:"fixed", width:"max-content", minWidth:"100%" }}>
          <colgroup>
            {block.headers.map((_, i) => <col key={i} style={{ width: columnWidths[i] || 180 }} />)}
            <col style={{ width: 50 }} />
          </colgroup>
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i}>
                  <div className="tbl-head">
                    <EditableText
                      value={h}
                      onChange={(v) => updHead(i, v)}
                      style={{ flex:1, fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0 }}
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); remCol(i); }}
                      className="tbl-del"
                      title="Delete column"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <span className="tbl-resize-handle" onMouseDown={(e) => startResize(i, e)} title="Resize column" />
                </th>
              ))}
              <th style={{ width:50 }}>
                <button onClick={addCol} className="tbl-add">+</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map(row => (
              <tr key={row.id}>
                {row.cells.map((c, i) => (
                  <td key={i}>
                    <div className="tbl-cell-inner">
                      <EditableText
                        value={c}
                        onChange={(v) => updCell(row.id, i, v)}
                        placeholder="…"
                        multiline
                        softBreakOnEnter
                        style={{ fontSize:14, lineHeight:1.55, color:"var(--text)", minHeight:24, paddingRight:22 }}
                      />
                      <button
                        className="tbl-cell-clear"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearCell(row.id, i); }}
                        title="Clear cell"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                ))}
                <td style={{ textAlign:"center", width:30 }}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); remRow(row.id); }}
                    className="row-del"
                    title="Delete row"
                    type="button"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow} className="tbl-add-row">+ row</button>
      </div>
    </div>
  );
}

// ====== CALENDAR ======
function CalendarBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock, data, setCurrentPage }) {
  const reachableIds = new Set([
    ...(data?.rootOrder || []),
    ...Object.values(data?.childOrder || {}).flat(),
  ]);
  const datedPages = Object.values(data?.pages || {})
    .filter((page) => !page.system && page.date && reachableIds.has(page.id))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const initialMonth = block.month || datedPages[0]?.date || localDateValue();
  const monthDate = new Date(`${initialMonth.slice(0, 7)}-01T00:00:00`);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const pagesByDay = datedPages.reduce((acc, page) => {
    const date = new Date(`${page.date}T00:00:00`);
    if (date.getFullYear() !== year || date.getMonth() !== month) return acc;
    const day = date.getDate();
    acc[day] = [...(acc[day] || []), page];
    return acc;
  }, {});

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      <div className="calendar-block">
        <div className="calendar-toolbar">
          <div className="calendar-title">{monthDate.toLocaleDateString(undefined, { month:"long", year:"numeric" })}</div>
          <input
            className="calendar-month-input"
            type="month"
            value={`${year}-${String(month + 1).padStart(2, "0")}`}
            onInput={(e) => {
              if (!e.target.value) return;
              updateBlock({ ...block, month:`${e.target.value}-01` });
            }}
            onChange={(e) => {
              if (!e.target.value) return;
              updateBlock({ ...block, month:`${e.target.value}-01` });
            }}
          />
        </div>
        <div className="calendar-grid">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
          {cells.map((day, index) => (
            <div key={`${day || "blank"}-${index}`} className={`calendar-cell ${day ? "" : "muted"}`}>
              {day && <div className="calendar-day">{day}</div>}
              {(pagesByDay[day] || []).map((page) => (
                <button key={page.id} className="calendar-page-pill" onClick={() => setCurrentPage?.(page.id)}>
                  <span>{page.icon || "📄"}</span>
                  <span>{page.title || "Untitled"}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ====== STANDALONE PROGRESS BLOCK ======
function ProgressBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock }) {
  const value = Math.max(0, Math.min(Number(block.value) || 0, Number(block.total) || 100));
  const total = Math.max(1, Number(block.total) || 100);
  const pct   = Math.min(100, Math.round((value / total) * 100));
  const colorMap = { accent:"var(--accent)", green:"var(--kpi-green)", amber:"var(--kpi-amber)", red:"var(--kpi-red)" };
  const fill = colorMap[block.color] || colorMap.accent;

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      <div className="progress-block">
        <div className="progress-block-header">
          <EditableText
            value={block.label || ""}
            onChange={(v) => updateBlock({ ...block, label: v })}
            placeholder="Label"
            style={{ fontSize:13, fontWeight:600, color:"var(--text)", flex:1 }}
          />
          <div className="progress-block-counts">
            <input
              className="progress-count-input"
              type="number"
              value={block.value ?? 0}
              onChange={(e) => updateBlock({ ...block, value: Number(e.target.value) })}
              title="Current value"
            />
            <span className="progress-sep">/</span>
            <input
              className="progress-count-input"
              type="number"
              value={block.total ?? 100}
              onChange={(e) => updateBlock({ ...block, total: Number(e.target.value) })}
              title="Total"
            />
          </div>
          <span className="progress-pct-label" style={{ color: fill }}>{pct}%</span>
        </div>
        <div className="progress-block-track">
          <div className="progress-block-fill" style={{ width:`${pct}%`, background: fill }} />
        </div>
        <div className="progress-block-colors">
          {["accent","green","amber","red"].map(c => (
            <button
              key={c}
              className={`progress-color-dot ${block.color === c ? "active" : ""}`}
              style={{ background: colorMap[c] }}
              onClick={() => updateBlock({ ...block, color: c })}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ====== DISPATCH ======
// Deterministic hue from an email string so each teammate always gets the
// same colour (matches Google Docs avatar behaviour).
function presenceColor(email) {
  if (!email) return "#888";
  let h = 0;
  for (let i = 0; i < email.length; i++) h = ((h << 5) - h) + email.charCodeAt(i);
  return `hsl(${Math.abs(h) % 360}, 65%, 52%)`;
}

function Block(props) {
  const [dropSide, setDropSide] = useState(null);
  const { block } = props;
  const isLocked = Boolean(props.lockedBy);
  const lockedEmail = props.lockedBy?.email || "";
  const lockedLabel = lockedEmail || "Teammate";
  const avatarLetter = lockedLabel[0].toUpperCase();
  const avatarBg = presenceColor(lockedEmail);
  const childProps = { ...props, blockId: block.id };
  let inner = null;
  switch (block.type) {
    case "heading":    inner = <HeadingBlock {...childProps} />; break;
    case "text":       inner = <TextBlock {...childProps} />; break;
    case "callout":    inner = <CalloutBlock {...childProps} />; break;
    case "bullets":    inner = <BulletsBlock {...childProps} />; break;
    case "numbers":    inner = <NumbersBlock {...childProps} />; break;
    case "checklist":  inner = <ChecklistBlock {...childProps} />; break;
    case "kpis":       inner = <KpisBlock {...childProps} />; break;
    case "milestones": inner = <MilestonesBlock {...childProps} />; break;
    case "table":      inner = <TableBlock {...childProps} />; break;
    case "calendar":   inner = <CalendarBlock {...childProps} />; break;
    case "progress":   inner = <ProgressBlock {...childProps} />; break;
    case "divider":    inner = (
      <div className="block-wrap">
        <BlockHandle blockId={block.id} onDragBlockStart={props.onDragBlockStart} onDragBlockEnd={props.onDragBlockEnd} />
        <BlockDeleteButton onDeleteBlock={props.onDeleteBlock} />
        <hr
          className="divider"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key !== "Backspace" && e.key !== "Delete") return;
            e.preventDefault();
            e.stopPropagation();
            props.onConvertToText?.("");
          }}
        />
      </div>
    ); break;
    default: return null;
  }
  return (
    <div
      data-block-id={block.id}
      className={`block-shell ${props.dragging ? "dragging" : ""} ${dropSide ? `drop-${dropSide}` : ""} ${isLocked ? "locked" : ""} ${props.multiSelected ? "multi-selected" : ""}`}
      onFocusCapture={() => {
        if (!isLocked) props.onBeginEditing?.();
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) props.onEndEditing?.();
      }}
      onMouseDownCapture={(e) => {
        if (!isLocked) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDownCapture={(e) => {
        if (!isLocked) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        setDropSide(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDropSide(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        props.onDropBlock?.(block.id, dropSide || "before");
        setDropSide(null);
      }}
    >
      {inner}
      {isLocked && (
        <div className="block-lock-badge" title={`${lockedLabel} is editing`}>
          <span className="presence-avatar" style={{ background: avatarBg }}>{avatarLetter}</span>
        </div>
      )}
    </div>
  );
}
window.Block = Block;
window.SLASH_COMMANDS = SLASH_COMMANDS;
