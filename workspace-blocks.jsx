// === Block components with slash commands, rich text, and inline editing ===
const { useState, useRef, useEffect, useCallback, useMemo } = React;

// ── Premium page-icon system ────────────────────────────────────────────────
// Pages can use either a plain emoji (legacy / user-picked) OR a premium key like
// "doc", "target", "rocket". Premium keys render as clean monochrome line icons
// (Lucide-style) instead of kiddish colour emoji. renderPageIcon() handles both.
const PREMIUM_ICON_PATHS = {
  doc:      '<path d="M4 2h6l4 4v12H4z"/><path d="M10 2v4h4"/>',
  target:   '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3.2"/>',
  rocket:   '<path d="M10 2c3 1.5 4.5 4.5 4.5 8L10 14l-4.5-4c0-3.5 1.5-6.5 4.5-8z"/><path d="M7.5 13.5 5 16m9.5-2.5L17 16M10 8.5v.01"/>',
  chart:    '<path d="M3 17V3"/><path d="M3 17h14"/><path d="M7 13l3-4 3 2 3-5"/>',
  spark:    '<path d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z"/>',
  bulb:     '<path d="M7 13a5 5 0 1 1 6 0c-.6.5-1 1-1 2H8c0-1-.4-1.5-1-2z"/><path d="M8 18h4"/>',
  flag:     '<path d="M5 17V3"/><path d="M5 4h9l-1.5 3L14 10H5"/>',
  folder:   '<path d="M3 6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  compass:  '<circle cx="10" cy="10" r="7.5"/><path d="M13 7l-2 5-4 1 2-5z"/>',
  bolt:     '<path d="M11 2 4 11h5l-1 7 7-9h-5z"/>',
  pin:      '<path d="M10 2a5 5 0 0 1 5 5c0 3.5-5 11-5 11S5 10.5 5 7a5 5 0 0 1 5-5z"/><circle cx="10" cy="7" r="1.8"/>',
  book:     '<path d="M4 4h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H4z"/><path d="M16 4h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5z"/>',
  box:      '<path d="M10 2 3 6v8l7 4 7-4V6z"/><path d="M3 6l7 4 7-4M10 10v8"/>',
  money:    '<circle cx="10" cy="10" r="7.5"/><path d="M10 6v8M8 8.5c0-1 .9-1.5 2-1.5s2 .5 2 1.4c0 2-4 1-4 3 0 1 .9 1.6 2 1.6s2-.6 2-1.5"/>',
  truck:    '<path d="M2 6h9v7H2z"/><path d="M11 9h4l2 2.5V13h-6z"/><circle cx="6" cy="15" r="1.4"/><circle cx="14" cy="15" r="1.4"/>',
  mega:     '<path d="M4 8v4l8 4V4z"/><path d="M4 8H3v4h1M14 7a4 4 0 0 1 0 6"/>',
  robot:    '<rect x="4" y="7" width="12" height="9" rx="2"/><path d="M10 4v3M7.5 11h.01M12.5 11h.01"/>',
  home:     '<path d="M3 9l7-6 7 6"/><path d="M5 8.5V17h10V8.5"/>',
  check:    '<rect x="3" y="3" width="14" height="14" rx="3"/><path d="M7 10l2.2 2.2L13.5 8"/>',
  calendar: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v3M13 2v3"/>',
};
const PREMIUM_DEFAULT_KEYS = ["doc", "spark", "bulb", "flag", "compass", "bolt", "chart", "rocket"];

// Map common (kiddish-looking) emoji to premium line-icon keys, so the sidebar /
// breadcrumbs render clean monochrome icons even for legacy emoji-based pages.
const EMOJI_TO_PREMIUM = {
  "📄":"doc","📝":"doc","🗒️":"doc","📃":"doc","📑":"doc",
  "💡":"bulb","🧠":"bulb","🎯":"target","🚀":"rocket","✨":"spark","⭐":"spark","🌟":"spark",
  "📊":"chart","📈":"chart","📉":"chart","🏁":"flag","🚩":"flag","🎌":"flag",
  "🗂️":"folder","📁":"folder","📂":"folder","🧭":"compass","⚡":"bolt","🔋":"bolt",
  "📌":"pin","📍":"pin","📖":"book","📚":"book","🔖":"book","📦":"box","🎁":"box",
  "💰":"money","💵":"money","💸":"money","🤑":"money","🚚":"truck","🚛":"truck","📦📦":"truck",
  "📣":"mega","📢":"mega","🔊":"mega","🤖":"robot","🦾":"robot","🏠":"home","🏡":"home",
  "✅":"check","☑️":"check","🗓️":"calendar","📅":"calendar","📆":"calendar","🧬":"spark","🛠️":"bolt","🔧":"bolt",
  "💧":"spark","🎬":"spark","🎥":"spark",
};
function isPremiumIconKey(icon) {
  return typeof icon === "string" && Object.prototype.hasOwnProperty.call(PREMIUM_ICON_PATHS, icon);
}
function resolveIconKey(icon) {
  if (isPremiumIconKey(icon)) return icon;
  if (typeof icon === "string" && EMOJI_TO_PREMIUM[icon]) return EMOJI_TO_PREMIUM[icon];
  return null;
}
function premiumIconSvg(key, size = 16) {
  const p = PREMIUM_ICON_PATHS[key];
  if (!p) return "";
  return `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block">${p}</svg>`;
}
// Render an icon (premium key OR mapped emoji → SVG element, else emoji text) for React.
function renderPageIcon(icon, size = 16) {
  const key = resolveIconKey(icon);
  if (key) {
    return React.createElement("span", {
      className: "premium-icon",
      style: { display: "inline-flex", width: size, height: size },
      dangerouslySetInnerHTML: { __html: premiumIconSvg(key, size) },
    });
  }
  return icon || "";
}
window.PREMIUM_ICON_PATHS = PREMIUM_ICON_PATHS;
window.PREMIUM_DEFAULT_KEYS = PREMIUM_DEFAULT_KEYS;
window.isPremiumIconKey = isPremiumIconKey;
window.resolveIconKey = resolveIconKey;
window.renderPageIcon = renderPageIcon;

const ALLOWED_INLINE_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "BR", "A"]);

// ── URL safety ──────────────────────────────────────────────────────────────
// Single source of truth for every href/src the app ever renders. Anything that
// isn't plainly http(s), mailto, or an inline data-image is rejected — which
// kills javascript:, vbscript:, file:, blob: and protocol-relative tricks.
function safeUrl(input, { allowDataImage = false } = {}) {
  const s = String(input || "").trim();
  if (!s || /[\s\u0000-\u001f]/.test(s)) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:[^\s]+$/i.test(s)) return s;
  if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(s)) return s;
  return "";
}
window.safeUrl = safeUrl;

// Elements whose content must never survive a paste (style/script blocks, doc head, etc.)
const DROP_TAGS = new Set(["STYLE","SCRIPT","HEAD","META","LINK","TITLE","NOSCRIPT","O:P"]);

function sanitizeHtml(input = "") {
  const template = document.createElement("template");
  template.innerHTML = String(input);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode("");

    const tag = node.tagName;
    // Drop non-content elements ENTIRELY (incl. their text). macOS apps (TextEdit,
    // Notes, Mail) put a <style>…</style> block in the HTML clipboard — without this
    // its CSS ("p.p1 { margin: 0 … font: 13px 'Helvetica Neue' }") leaks in as text.
    if (DROP_TAGS.has(tag)) return document.createTextNode("");
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

    // Links keep ONLY a validated href (killing javascript:/event-handler attrs)
    // and always open safely in a new tab. A link with no safe href unwraps to
    // plain text via the fragment path above.
    if (tag === "A") {
      const href = safeUrl(node.getAttribute("href"));
      if (!href) {
        const frag = document.createDocumentFragment();
        node.childNodes.forEach((child) => frag.appendChild(cleanNode(child)));
        return frag;
      }
      const a = document.createElement("a");
      a.setAttribute("href", href);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      node.childNodes.forEach((child) => a.appendChild(cleanNode(child)));
      return a;
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
// Handles both native <input type="checkbox"> and Notion-style div checkboxes.
function extractListItems(listNode, level = 0) {
  const items = [];
  const lis = Array.from(listNode.querySelectorAll(":scope > li"));
  // Detect if this list is explicitly marked as a to-do/checklist list
  const isToDoList = (listNode.className || "").includes("to-do") ||
                     listNode.getAttribute("data-checklist") === "1";
  for (const li of lis) {
    const text = liDirectText(li);
    const item = { id: nid(), text, level };

    // 1. Native <input type="checkbox"> (WAULT internal format)
    const nativeCb = li.querySelector('input[type="checkbox"]');
    const roleCb   = li.querySelector('[role="checkbox"]');
    // 2. Notion-style divs: class contains "checkbox-on" / "checkbox-off" / "to-do"
    const notionOn  = li.querySelector('[class*="checkbox-on"], [class*="checked"]');
    const notionOff = li.querySelector('[class*="checkbox-off"], [class*="unchecked"]');
    // 3. The li itself bears a to-do class, or the parent list is a to-do-list
    const hasToDoMarker = isToDoList ||
                          (li.className || "").includes("to-do") ||
                          notionOn || notionOff;

    if (nativeCb) {
      item.done = nativeCb.checked;
      item.dueDate = "";
    } else if (roleCb) {
      item.done = roleCb.getAttribute("aria-checked") === "true";
      item.dueDate = "";
    } else if (hasToDoMarker) {
      // Notion to-do: presence of "on" variant means done
      item.done = !!notionOn;
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

  // Strip non-content elements (macOS <style> blocks, scripts, doc head) AND any
  // WAULT UI chrome that a native browser copy may have captured — delete buttons
  // (the stray "×"), drag handles, add-row "+", lock badges, etc.
  container.querySelectorAll(
    "style, script, head, meta, link, title, noscript, button, " +
    ".row-del, .tbl-del, .block-delete-btn, .block-handle, .tbl-add, .tbl-add-row, " +
    ".bullet-dot, .number-dot, .block-lock-badge, .tbl-resize-handle, .ct-col-del"
  ).forEach((n) => n.remove());

  // ── WAULT-internal paste: restore the EXACT blocks from embedded JSON. ──
  // This guarantees no format ever changes on a copy→paste inside the app
  // (milestones, KPIs, progress, content-shooting-tables, nested lists, etc.).
  const waultEl = container.querySelector("[data-wault-blocks]") ||
                  (container.firstElementChild?.matches?.("[data-wault-blocks]") ? container.firstElementChild : null);
  if (waultEl) {
    try {
      const raw = decodeURIComponent(waultEl.getAttribute("data-wault-blocks") || "");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((b) => window.regenBlockIds ? window.regenBlockIds(b) : b);
      }
    } catch (_) { /* fall through to HTML parsing */ }
  }

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
    if (DROP_TAGS.has(tag)) return; // never recurse into <style>/<script>/etc.

    if (tag === "H1" || tag === "H2" || tag === "H3") {
      const text = inlineHtml(node);
      if (node.textContent?.trim()) blocks.push({ id: nid(), type:"heading", level: parseInt(tag[1]), text });
      return;
    }
    if (tag === "P") {
      // Images travel inside <p> wrappers (Google Docs, our own serializer) —
      // surface them as image blocks before handling the paragraph text.
      node.querySelectorAll("img").forEach((img) => {
        const src = safeUrl(img.getAttribute("src"), { allowDataImage: true });
        if (src) blocks.push({ id: nid(), type:"image", src, alt: (img.getAttribute("alt") || "").slice(0, 300) });
      });
      const text = inlineHtml(node);
      if (node.textContent?.trim()) blocks.push({ id: nid(), type:"text", text });
      return;
    }
    if (tag === "UL" || tag === "OL") {
      const items = extractListItems(node, 0);
      if (!items.length) return;
      // Detect checklist: any item has `done` property, or parent UL is Notion to-do-list
      const isToDoList = (node.className || "").includes("to-do") ||
                         node.getAttribute("data-checklist") === "1";
      if (items.some(i => "done" in i) || isToDoList) {
        blocks.push({ id: nid(), type:"checklist", items: items.map(i => ({ id: i.id, text: i.text, done: !!i.done, dueDate: i.dueDate || "" })) });
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
    if (tag === "IMG") {
      const src = safeUrl(node.getAttribute("src"), { allowDataImage: true });
      if (src) blocks.push({ id: nid(), type:"image", src, alt: (node.getAttribute("alt") || "").slice(0, 300) });
      return;
    }
    if (tag === "TABLE") {
      const cellText = (c) => (window.stripHtml ? window.stripHtml(c.innerHTML) : c.textContent || "").replace(/​/g, "").trim();
      // Checkbox-only cells (a lone <input type=checkbox>) become "1"/"" so WAULT
      // checkbox columns survive a copy→paste round-trip.
      const cellVal = (c) => {
        const cb = c.querySelector('input[type="checkbox"]');
        if (cb && !cellText(c)) return cb.checked ? "1" : "";
        return cellText(c);
      };
      const isCheckCell = (c) => !!c.querySelector('input[type="checkbox"]') && !cellText(c);
      const rowEls = (tr) => Array.from(tr.querySelectorAll(":scope > th, :scope > td"));
      const thead = node.querySelector("thead");
      let headerCells = [];
      let bodyTrs = [];
      if (thead) {
        // Explicit header row(s) → first thead row is the header; everything else is body.
        const theadTr = thead.querySelector("tr");
        if (theadTr) headerCells = rowEls(theadTr).map(cellText);
        bodyTrs = Array.from(node.querySelectorAll("tbody tr"));
        if (!bodyTrs.length) bodyTrs = Array.from(node.querySelectorAll("tr")).filter((tr) => !thead.contains(tr));
      } else {
        // No <thead> → the FIRST row is the header, the rest are the body.
        const allTrs = Array.from(node.querySelectorAll("tr"));
        if (allTrs.length) headerCells = rowEls(allTrs[0]).map(cellText);
        bodyTrs = allTrs.slice(1);
      }
      const bodyRows = bodyTrs.map((tr) => ({ id: nid(), cells: rowEls(tr).map(cellVal) }));
      // Column types: explicit data attribute (WAULT copy) wins; otherwise infer a
      // checkbox column when at least one body cell in it is a bare checkbox.
      let colTypes = null;
      const declared = (node.getAttribute("data-col-types") || "").split(",").map((t) => t === "checkbox" ? "checkbox" : "text");
      if (declared.length === headerCells.length && declared.includes("checkbox")) {
        colTypes = declared;
      } else if (bodyTrs.length) {
        const inferred = headerCells.map((_, i) => bodyTrs.some((tr) => { const c = rowEls(tr)[i]; return c && isCheckCell(c); }) ? "checkbox" : "text");
        if (inferred.includes("checkbox")) colTypes = inferred;
      }
      if (headerCells.length) {
        const tbl = { id: nid(), type:"table", headers: headerCells, rows: bodyRows.length ? bodyRows : [{ id: nid(), cells: headerCells.map(() => "") }] };
        if (colTypes) tbl.colTypes = colTypes;
        blocks.push(tbl);
      }
      return;
    }
    // DIV / SECTION / ARTICLE / SPAN / etc. — recurse into children
    node.childNodes.forEach(processNode);
  };

  container.childNodes.forEach(processNode);
  return blocks;
}
window.parseHtmlBlocks = parseHtmlBlocks;

// Build properly NESTED <ul>/<ol> HTML from a flat item list that carries `level`
// (0-based depth). This preserves nested bullet/number structure on copy so that
// pasting back (or into Notion/Docs/Word) keeps the indentation and per-level numbering.
function itemsToNestedListHtml(items, tag) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return `<${tag}></${tag}>`;
  const s = (t) => t || "";
  // Normalize so the shallowest item sits at level 0.
  const base = Math.min(...list.map((i) => Math.max(0, i.level || 0)));
  const norm = list.map((i) => ({ text: s(i.text), level: Math.max(0, (i.level || 0) - base) }));
  // Clamp level jumps to at most +1 per item — HTML can't validly nest two levels deep
  // without an intermediate <li>, and skipping levels would drop items on reparse.
  let clampPrev = -1;
  norm.forEach((it) => {
    it.level = Math.min(it.level, clampPrev + 1);
    clampPrev = it.level;
  });

  let html = "";
  let prevLevel = -1;
  norm.forEach((it) => {
    if (it.level > prevLevel) {
      // Open one new nested list per level we descend (nested INSIDE the open <li>).
      for (let d = prevLevel; d < it.level; d++) html += `<${tag}>`;
    } else if (it.level < prevLevel) {
      html += `</li>`; // close current item
      for (let d = prevLevel; d > it.level; d--) html += `</${tag}></li>`;
    } else {
      html += `</li>`; // sibling — close previous item
    }
    html += `<li>${it.text}`;
    prevLevel = it.level;
  });
  html += `</li>`;
  for (let d = prevLevel; d > 0; d--) html += `</${tag}></li>`;
  html += `</${tag}>`;
  return html;
}

// Serialize a block to semantic HTML so the clipboard carries proper structure.
function serializeBlockToHtml(block) {
  const s = (t) => t || "";
  switch (block.type) {
    case "heading":  return `<h${block.level}>${s(block.text)}</h${block.level}>`;
    case "text":     return `<p>${s(block.text)}</p>`;
    case "callout":  return `<blockquote>${s(block.text)}</blockquote>`;
    case "divider":  return `<hr>`;
    case "image": {
      const u = safeUrl(block.src, { allowDataImage: true });
      return u ? `<p><img src="${u.replace(/"/g, "%22")}" alt=""></p>` : "";
    }
    case "bullets":
      return itemsToNestedListHtml(block.items, "ul");
    case "numbers":
      return itemsToNestedListHtml(block.items, "ol");
    case "checklist":
      // Real checkbox <input> so pasting BACK into WAULT is detected as a checklist
      // (extractListItems looks for input[type=checkbox]); external editors render a box too.
      return `<ul data-checklist="1" data-block-type="checklist">${(block.items||[]).map(i=>`<li><input type="checkbox"${i.done?" checked":""}> ${s(i.text)}</li>`).join("")}</ul>`;
    case "milestones":
      return `<ul data-checklist="1">${(block.items||[]).map(i=>`<li><input type="checkbox"${i.status==="done"?" checked":""}> ${s(i.name)}</li>`).join("")}</ul>`;
    case "table": {
      const types = (block.headers||[]).map((_, i) => (block.colTypes || [])[i] || "text");
      const hdrs = (block.headers||[]).map(h=>`<th>${h}</th>`).join("");
      const rows = (block.rows||[]).map(r=>`<tr>${(r.cells||[]).map((c, i)=> types[i] === "checkbox"
        ? `<td><input type="checkbox"${c ? " checked" : ""}></td>`
        : `<td>${c}</td>`).join("")}</tr>`).join("");
      return `<table data-col-types="${types.join(",")}"><thead><tr>${hdrs}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case "content-shooting-table": {
      const cols = block.columns || DEFAULT_SHOOT_COLS;
      const hdrs = ["Done", ...cols].map(h=>`<th>${s(h)}</th>`).join("");
      const rows = (block.rows||[]).map(r=>`<tr><td>${r.checked ? "Yes" : ""}</td>${cols.map((_, i)=>`<td>${s((r.cells||[])[i] || "")}</td>`).join("")}</tr>`).join("");
      return `<table><thead><tr>${hdrs}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case "kpis":
      return `<ul data-block-type="kpis">${(block.items||[]).map(i=>`<li>${s(i.label)}: ${s(i.value)}${s(i.unit)}${i.target?` / ${s(i.target)}${s(i.unit)}`:""}</li>`).join("")}</ul>`;
    case "progress":
      return `<p data-block-type="progress">${s(block.label)}: ${s(block.value)}/${s(block.total)}</p>`;
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
    case "image":    return safeUrl(block.src, { allowDataImage: true }) || "";
    case "bullets": {
      const list = (block.items||[]).filter(Boolean);
      const base = list.length ? Math.min(...list.map(i=>Math.max(0,i.level||0))) : 0;
      return list.map(i=>`${"  ".repeat(Math.max(0,(i.level||0)-base))}- ${plain(i.text)}`).join("\n");
    }
    case "numbers": {
      // Indent by level AND restart numbering at each nesting level. Markers use
      // the SAME 1./a./i. cycle the editor renders, so external pastes look
      // identical to WAULT and paste back into the right levels.
      const list = (block.items||[]).filter(Boolean);
      const base = list.length ? Math.min(...list.map(i=>Math.max(0,i.level||0))) : 0;
      const counters = {};
      return list.map(i=>{
        const lvl = Math.max(0,(i.level||0)-base);
        Object.keys(counters).forEach(k=>{ if (+k > lvl) delete counters[k]; });
        counters[lvl] = (counters[lvl]||0) + 1;
        return `${"  ".repeat(lvl)}${markerForNumberLevel(lvl, counters[lvl])} ${plain(i.text)}`;
      }).join("\n");
    }
    case "checklist":return (block.items||[]).map(i=>`- [${i.done?"x":" "}] ${plain(i.text)}`).join("\n");
    case "milestones":return (block.items||[]).map(i=>`- [${i.status==="done"?"x":" "}] ${plain(i.name)}`).join("\n");
    case "table": {
      // Tab-separated so it pastes cleanly into Sheets / Excel / Word tables.
      const types = (block.headers||[]).map((_, i) => (block.colTypes || [])[i] || "text");
      const rows = [
        (block.headers||[]).map(h=>plain(h)).join("\t"),
        ...(block.rows||[]).map(r=>(r.cells||[]).map((c, i)=> types[i] === "checkbox" ? (c ? "[x]" : "[ ]") : plain(c)).join("\t")),
      ];
      return rows.join("\n");
    }
    case "content-shooting-table": {
      const cols = block.columns || DEFAULT_SHOOT_COLS;
      const rows = [
        ["Done", ...cols].map(h=>plain(h)).join("\t"),
        ...(block.rows||[]).map(r=>[
          r.checked ? "Yes" : "",
          ...cols.map((_, i)=>plain((r.cells||[])[i] || "")),
        ].join("\t")),
      ];
      return rows.join("\n");
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

// Give a block (and its items/rows) brand-new ids so a paste never collides with
// the source blocks still on the page.
function regenBlockIds(block) {
  const b = JSON.parse(JSON.stringify(block));
  b.id = nid();
  if (Array.isArray(b.items)) b.items = b.items.map((i) => ({ ...i, id: nid() }));
  if (Array.isArray(b.rows))  b.rows  = b.rows.map((r) => ({ ...r, id: nid() }));
  return b;
}
window.regenBlockIds = regenBlockIds;

// Sanitize every rich-text field of an UNTRUSTED block payload (e.g. the
// application/x-wault-blocks clipboard JSON, which any web page could forge).
// Without this, a crafted payload could smuggle arbitrary HTML into block text.
function sanitizeBlockPayload(block) {
  const b = JSON.parse(JSON.stringify(block));
  const clean = (h) => sanitizeHtml(String(h == null ? "" : h));
  if (typeof b.text === "string") b.text = clean(b.text);
  if (typeof b.label === "string") b.label = stripHtml(b.label);
  if (typeof b.icon === "string") b.icon = stripHtml(b.icon).slice(0, 8);
  if (typeof b.src === "string") b.src = safeUrl(b.src, { allowDataImage: true });
  if (typeof b.alt === "string") b.alt = stripHtml(b.alt).slice(0, 300);
  if (Array.isArray(b.items)) {
    b.items = b.items.map((i) => ({
      ...i,
      ...(typeof i?.text === "string" ? { text: clean(i.text) } : {}),
      ...(typeof i?.name === "string" ? { name: stripHtml(i.name) } : {}),
      ...(typeof i?.label === "string" ? { label: stripHtml(i.label) } : {}),
    }));
  }
  if (Array.isArray(b.headers)) b.headers = b.headers.map((h) => clean(h));
  if (Array.isArray(b.columns)) b.columns = b.columns.map((c) => stripHtml(String(c ?? "")));
  if (Array.isArray(b.rows)) {
    b.rows = b.rows.map((r) => ({ ...r, cells: (r?.cells || []).map((c) => clean(c)) }));
  }
  return b;
}
window.sanitizeBlockPayload = sanitizeBlockPayload;

// Read the exact-blocks payload from a paste event's custom clipboard type.
// Returns sanitized blocks with fresh ids, or null when absent/invalid.
function readWaultClipboardPayload(e) {
  try {
    const raw = e.clipboardData?.getData("application/x-wault-blocks");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length || parsed.length > 500) return null;
    return parsed
      .filter((b) => b && typeof b === "object" && typeof b.type === "string")
      .map((b) => regenBlockIds(sanitizeBlockPayload(b)));
  } catch (_) { return null; }
}
window.readWaultClipboardPayload = readWaultClipboardPayload;

// ── In-memory clipboard ─────────────────────────────────────────────────────
// The OS pasteboard can (and on macOS does) rewrite text/html and drop data-*
// attributes, which corrupts an HTML-only round-trip. So for internal copy we
// ALSO stash the exact blocks in memory. On paste, if the plain text matches
// what we copied, we restore these blocks verbatim — 100% faithful, no matter
// what the OS did to the HTML. This is how Notion/Craft guarantee fidelity.
window._waultClipboard = null;

// Build the clipboard payload for a set of WAULT blocks AND remember them in
// memory. text/html carries semantic HTML (for Word/Docs/Notion) plus the block
// JSON in a data attribute; text/plain is the human-readable version.
function serializeBlocksForClipboard(blocks) {
  const list = (blocks || []).filter(Boolean);
  try { window._waultClipboard = JSON.parse(JSON.stringify(list)); } catch (_) { window._waultClipboard = null; }
  const inner = list.map((b) => serializeBlockToHtml(b)).join("\n");
  let enc = "";
  try { enc = encodeURIComponent(JSON.stringify(list)); } catch (_) {}
  const html = `<div data-wault-blocks="${enc}">${inner}</div>`;
  const text = list.map((b) => serializeBlockToText(b)).join("\n\n");
  return { html, text };
}
window.serializeBlocksForClipboard = serializeBlocksForClipboard;

// If the pasted plain text is exactly what we last copied inside WAULT, return
// the stored blocks (with fresh ids). Otherwise null → caller parses normally.
function matchWaultClipboard(plainText) {
  const store = window._waultClipboard;
  if (!store || !store.length || !plainText) return null;
  const norm = (s) => String(s).replace(/\r\n?/g, "\n").replace(/​/g, "").trim();
  const storedText = store.map((b) => serializeBlockToText(b)).join("\n\n");
  // Primary: exact match (ideal — clipboard preserved all whitespace).
  if (norm(storedText) && norm(storedText) === norm(plainText)) {
    return store.map((b) => regenBlockIds(b));
  }
  // Fallback: macOS and some clipboard managers strip leading whitespace from
  // plain text, turning "  1. sub" into "1. sub". The content lines still match;
  // compare with indentation removed from both sides and restore from memory
  // (levels are intact there — plain text was just the fingerprint, not the data).
  const stripIndent = (s) => norm(s).replace(/^[ \t]+/gm, "");
  const storedFlat = stripIndent(storedText);
  if (storedFlat && storedFlat === stripIndent(plainText)) {
    return store.map((b) => regenBlockIds(b));
  }
  return null;
}
window.matchWaultClipboard = matchWaultClipboard;

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
  const isTsvLine = (line) => line.includes("\t");
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

    if (isTsvLine(line)) {
      flushParagraph();
      const tableLines = [];
      while (i < lines.length && isTsvLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;
      const parsedRows = tableLines.map((row) => row.split("\t").map(cleanCell));
      const usefulRows = parsedRows.filter((row) => row.some((cell) => cell.trim()));
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
      const match = lines[j].trim().match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
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

    // Infer nesting level from leading whitespace: every 2 spaces (or 1 tab) = one level.
    const indentLevel = (raw) => {
      const lead = (raw.match(/^[ \t]*/) || [""])[0];
      const spaces = lead.replace(/\t/g, "  ").length;
      return Math.floor(spaces / 2);
    };

    const bulletItems = [];
    j = i;
    while (j < lines.length) {
      const raw = lines[j];
      const match = raw.trim().match(/^(?:[-*•])\s+(.+)$/);
      if (!match || /^[-*]\s+\[[ xX]\]\s+/.test(raw.trim())) break;
      bulletItems.push({ id: nid(), text: parseInlineMd(match[1].trim()), level: indentLevel(raw) });
      j++;
    }
    if (bulletItems.length) {
      flushParagraph();
      const base = Math.min(...bulletItems.map(it => it.level || 0));
      bulletItems.forEach(it => { it.level = Math.max(0, (it.level || 0) - base); });
      blocks.push({ id: nid(), type:"bullets", items: bulletItems });
      i = j - 1;
      continue;
    }

    // Numbered lists in plain text: digits (1. 2.), alpha (a. b.), roman (i. ii. iv.).
    // Marker style implies a nesting level (digits→0, alpha→1, roman→2) which we
    // combine with leading-indent level so "1. / a. / i." paste back as a nested list
    // even when the clipboard stripped the indentation.
    // 1–39 only (i…xxxix): real list markers are small; the full roman grammar would
    // false-match English words like "mix." or "did." at the start of a sentence.
    const ROMAN_RE = /^(?=[ivx])(x{0,3})(ix|iv|v?i{0,3})$/;
    const classifyMarker = (line) => {
      const m = line.trim().match(/^([0-9]+|[A-Za-z]+)[.)]\s+(.+)$/);
      if (!m) return null;
      const marker = m[1];
      if (/^\d+$/.test(marker)) return { style: 0, text: m[2], ord: parseInt(marker, 10) };
      const low = marker.toLowerCase();
      const isRoman = ROMAN_RE.test(low);
      const isAlpha = /^[a-z]$/.test(low);
      if (isRoman && isAlpha) {
        // Ambiguous single letter (i, v, x): resolved by the caller from sequence
        // context — "i." right after "h." is alphabetical, otherwise roman.
        return { style: 2, text: m[2], ord: low.charCodeAt(0) - 96, ambiguous: true };
      }
      if (isRoman) return { style: 2, text: m[2], ord: 0 };
      if (isAlpha) return { style: 1, text: m[2], ord: low.charCodeAt(0) - 96 };
      return null;
    };
    const numberItems = [];
    j = i;
    let prevStyle = -1;
    let prevAlphaOrd = 0;
    while (j < lines.length) {
      const raw = lines[j];
      const cls = classifyMarker(raw);
      if (!cls) break;
      // Disambiguate i/v/x: alpha ONLY when it continues the alphabet run
      // ("h. → i.", "u. → v."); after "a./b." or standalone, "i." is roman.
      let style = cls.style;
      if (cls.ambiguous) style = (prevStyle === 1 && cls.ord === prevAlphaOrd + 1) ? 1 : 2;
      const indent = indentLevel(raw);
      // Indentation wins when present; otherwise the marker style sets the level.
      const level = indent > 0 ? indent : style;
      numberItems.push({ id: nid(), text: parseInlineMd(cls.text.trim()), level });
      prevStyle = style;
      if (style === 1) prevAlphaOrd = cls.ord;
      j++;
    }
    if (numberItems.length) {
      flushParagraph();
      const base = Math.min(...numberItems.map(it => it.level || 0));
      numberItems.forEach(it => { it.level = Math.max(0, (it.level || 0) - base); });
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

function isCursorAtEnd(el) {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return false;
  const range = sel.getRangeAt(0);
  const after = range.cloneRange();
  after.selectNodeContents(el);
  after.setStart(range.startContainer, range.startOffset);
  return after.toString().replace(/\u200B/g, "").length === 0;
}

// Visual line checks \u2014 used for ArrowUp/Down so navigation fires on the first keypress
// from any cursor position in a single-line block, matching Notion's behaviour.
function isCursorOnFirstLine(el) {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return false;
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
  // Single-line element: cursor is always on the first (and only) line
  if (el.getBoundingClientRect().height <= lh + 6) return true;
  // Multi-line: use the caret's visual rect
  const rects = sel.getRangeAt(0).getClientRects();
  if (!rects.length) return true;
  return rects[0].top <= el.getBoundingClientRect().top + lh + 2;
}

function isCursorOnLastLine(el) {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return false;
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
  // Single-line element: cursor is always on the last (and only) line
  if (el.getBoundingClientRect().height <= lh + 6) return true;
  // Multi-line: use the caret's visual rect
  const rects = sel.getRangeAt(0).getClientRects();
  if (!rects.length) return true;
  return rects[0].bottom >= el.getBoundingClientRect().bottom - lh - 2;
}

// ── Caret-X preservation for arrow navigation ──────────────────────────────
// When the user presses ArrowUp/Down, we capture the horizontal caret position
// before handing off to the adjacent block. On focus, we restore the caret to
// that same X coordinate — matching Notion's "cursor stays at same column" UX.
let _pendingCaretX = null;
let _pendingCaretEdge = "bottom"; // "top" = came from below, "bottom" = came from above

function capturePendingCaretX(edge) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) { _pendingCaretX = null; return; }
  const rects = sel.getRangeAt(0).getClientRects();
  _pendingCaretX = rects.length ? rects[0].left : null;
  _pendingCaretEdge = edge;
}

function applyPendingCaretX(el) {
  if (_pendingCaretX == null || !el) return;
  const x = _pendingCaretX;
  const edge = _pendingCaretEdge;
  _pendingCaretX = null;
  _pendingCaretEdge = "bottom";
  const rect = el.getBoundingClientRect();
  if (!rect.height) return;
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
  // Sample the Y coordinate on the first line (came from below) or last line (came from above)
  const y = edge === "top" ? rect.top + lh / 2 : rect.bottom - lh / 2;
  const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
  if (range && el.contains(range.startContainer)) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
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

// Splits innerHTML at the current cursor position into before/after HTML fragments
function splitHtmlAtCaret(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
    return { before: el.innerHTML, after: "" };
  }
  const range = sel.getRangeAt(0);

  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const beforeDiv = document.createElement("div");
  beforeDiv.appendChild(beforeRange.cloneContents());

  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(el);
  afterRange.setStart(range.startContainer, range.startOffset);
  const afterDiv = document.createElement("div");
  afterDiv.appendChild(afterRange.cloneContents());

  return { before: beforeDiv.innerHTML, after: afterDiv.innerHTML };
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
  focusAtStart = false, onMoveToPreviousBlock, onMoveToNextBlock, onDeleteAtEnd,
}) {
  const ref = useRef(null);
  const lastValue = useRef(sanitizeHtml(value || ""));
  const skipUpdate = useRef(false);
  const slashActiveRef = useRef(false);
  // While an IME composition is active (Chinese/Japanese/Korean, accent dead-keys, etc.)
  // the browser fires intermediate `input` events with half-composed text. Committing
  // those to React state corrupts the candidate window and drops/duplicates characters.
  // We hold all commits until compositionend.
  const composingRef = useRef(false);

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
    // Capture where the caret was BEFORE we overwrite innerHTML, so a remote/cross-tab
    // sync that lands mid-typing doesn't yank the cursor to the end of the block.
    const prevCaret = wasFocused ? getCaretOffset(ref.current) : null;
    ref.current.innerHTML = safeValue;
    lastValue.current = safeValue;

    // Restore the caret to (roughly) where it was. setCaretOffset clamps to the
    // available text length, so this is safe even when the new content is shorter.
    if (wasFocused) {
      try {
        if (prevCaret != null) {
          setCaretOffset(ref.current, prevCaret);
        } else {
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (_) {}
    }
  }, [value]);

  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    // preventScroll: true stops the browser auto-scrolling to the element on focus.
    // The caret operations below position the cursor; scroll happens only when the user types.
    ref.current.focus({ preventScroll: true });
    // If arrow navigation captured a horizontal position, restore the caret there
    // instead of jumping to start/end — Notion's "same column" behaviour.
    if (_pendingCaretX != null) {
      applyPendingCaretX(ref.current);
      return;
    }
    // If a merge operation captured a specific character offset (Backspace-at-start merge),
    // place the cursor exactly there so it lands at the junction, not at end of the block.
    if (window._pendingCaretOffset != null) {
      const offset = window._pendingCaretOffset;
      window._pendingCaretOffset = null;
      setCaretOffset(ref.current, offset);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    range.collapse(focusAtStart ? true : false); // true=start, false=end
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [autoFocus, focusKey, focusAtStart]);

  const handleInput = () => {
    // Don't touch the DOM / React state mid-composition — wait for compositionend.
    if (composingRef.current) return;
    skipUpdate.current = true;
    const raw = ref.current.innerHTML;
    // Only run full sanitise when the browser has injected block-level tags
    // (avoids expensive DOM work on every plain-text keystroke)
    const needsSanitize = raw.includes("<div") || raw.includes("<p>") || raw.includes("<p ") || raw.includes("<span") || raw.includes("<a ") || raw.includes("<a>") || raw.includes("<img");
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
    // Ignore keystrokes that are part of an active IME composition. keyCode 229 is the
    // legacy "composition in progress" sentinel; e.isComposing is the modern flag.
    // Without this, pressing Enter to pick a CJK candidate would split the block.
    if (e.isComposing || e.keyCode === 229 || composingRef.current) return;
    // Bold / Italic / Underline / Link
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === "b") { e.preventDefault(); document.execCommand("bold"); handleInput(); return; }
      if (e.key === "i") { e.preventDefault(); document.execCommand("italic"); handleInput(); return; }
      if (e.key === "u") { e.preventDefault(); document.execCommand("underline"); handleInput(); return; }
      if (e.key === "k") {
        e.preventDefault();
        const sel = window.getSelection();
        const hasSelection = sel && !sel.isCollapsed && ref.current.contains(sel.anchorNode);
        const raw = window.prompt("Link URL (https://…)", "https://");
        if (raw == null) return;
        const href = window.safeUrl ? window.safeUrl(raw) : "";
        if (!href) { window.alert("Only http(s) and mailto links are allowed."); return; }
        if (hasSelection) {
          document.execCommand("createLink", false, href);
        } else {
          const esc = href.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
          document.execCommand("insertHTML", false, `<a href="${esc}">${esc}</a>`);
        }
        handleInput(); // sanitizeHtml normalises the anchor (target/rel, scrubbed attrs)
        return;
      }
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
        if (txt === "[]" || txt === "[ ]") {
          e.preventDefault();
          e.stopPropagation();
          onMarkdownShortcut("checklist");
          return;
        }
        // # / ## / ### → Heading 1/2/3
        if (/^#{1,3}$/.test(txt)) {
          e.preventDefault();
          e.stopPropagation();
          onMarkdownShortcut("heading" + txt.length);
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
        const split = splitHtmlAtCaret(ref.current);
        // onEnter may return headHtml if the block was split at cursor.
        // EditableText owns the DOM, so we update it here directly — no React sync delay.
        const headHtml = onEnter(ref.current.innerText || "", caretPos, split);
        if (headHtml != null) {
          const safeHead = sanitizeHtml(headHtml);
          ref.current.innerHTML = safeHead;
          lastValue.current = safeHead;
          skipUpdate.current = false;
          onChange(safeHead);
        }
        return;
      }
      if (!multiline) {
        e.preventDefault();
        e.stopPropagation();
        ref.current.blur();
      }
    }
    // Only Backspace deletes an empty/whole block. Forward-Delete must NOT route here \u2014
    // doing so deleted the current line and jumped the caret *backwards* (wrong block).
    if (e.key === "Backspace" && onBackspaceEmpty) {
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
    // Forward-Delete at the very end of a block merges the NEXT block/item in,
    // mirroring Backspace-at-start — Google Docs behaviour across "paragraphs".
    if (e.key === "Delete" && onDeleteAtEnd && isCursorAtEnd(ref.current)) {
      e.preventDefault();
      e.stopPropagation();
      onDeleteAtEnd(ref.current.innerHTML || "");
      return;
    }
    // Arrow key navigation between blocks — uses visual line check so the cursor
    // jumps to the adjacent block on the very first keypress (Notion behaviour),
    // not after first moving to the start/end of the current line.
    if (e.key === "ArrowUp" && onMoveToPreviousBlock && isCursorOnFirstLine(ref.current)) {
      e.preventDefault();
      e.stopPropagation();
      capturePendingCaretX("bottom"); // going UP → land on last line of prev block
      onMoveToPreviousBlock("end");
    }
    if (e.key === "ArrowDown" && onMoveToNextBlock && isCursorOnLastLine(ref.current)) {
      e.preventDefault();
      e.stopPropagation();
      capturePendingCaretX("top"); // going DOWN → land on first line of next block
      onMoveToNextBlock("start");
    }
    // Plain ArrowLeft/Right walk across block boundaries like one continuous
    // document: Left at the very start → end of previous block; Right at the very
    // end → start of next block. Modifier combos (Shift-select, Cmd-line-jump,
    // Alt-word-jump) keep their native behaviour.
    const plainArrow = !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (e.key === "ArrowLeft" && plainArrow && onMoveToPreviousBlock && isCursorAtStart(ref.current)) {
      e.preventDefault();
      e.stopPropagation();
      _pendingCaretX = null; // land exactly at the END of the previous block
      onMoveToPreviousBlock("end");
    }
    if (e.key === "ArrowRight" && plainArrow && onMoveToNextBlock && isCursorAtEnd(ref.current)) {
      e.preventDefault();
      e.stopPropagation();
      _pendingCaretX = null; // land exactly at the START of the next block
      onMoveToNextBlock("start");
    }
  };

  const handleCompositionStart = () => { composingRef.current = true; };
  const handleCompositionEnd = () => {
    composingRef.current = false;
    // Commit the fully-composed text now that the IME has finished.
    handleInput();
  };

  const handleBlur = () => {
    // A composition can be left "open" if the field loses focus mid-input.
    composingRef.current = false;
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
      // (-1) Exact payload from WAULT's own copy handler (custom clipboard type) —
      // survives across tabs/windows where the in-memory clipboard can't help.
      // A single plain text block falls through to inline insertion instead, so
      // pasting copied text inside a list item never replaces the whole block.
      const exact = readWaultClipboardPayload(e);
      if (exact && exact.length && !(exact.length === 1 && exact[0].type === "text")) {
        onPasteBlocks(exact, exact[0]?.id);
        return;
      }
      // (0) Faithful internal paste: exact blocks we copied inside WAULT.
      const mine = window.matchWaultClipboard ? window.matchWaultClipboard(text) : null;
      if (mine && mine.length) { onPasteBlocks(mine, mine[0]?.id); return; }
    }

    // ── Bare URL paste ───────────────────────────────────────────────────
    // A lone URL becomes a clickable link (or links the selected text); an
    // image URL pasted on an empty plain-text line becomes an image block.
    const pastedUrl = !text.includes("\n") && window.safeUrl ? window.safeUrl(text.trim()) : "";
    if (pastedUrl) {
      const isImageUrl = /\.(png|jpe?g|gif|webp|avif|svg)([?#][^\s]*)?$/i.test(pastedUrl);
      const isEmptyLine = !(ref.current.innerText || "").replace(/​/g, "").trim();
      // Only a top-level text line may convert into an image block — converting
      // inside a list/table/callout would replace the whole surrounding block.
      const isPlainTextHost = !ref.current.closest(".list-row, .check-row, td, th, .callout");
      if (isImageUrl && isEmptyLine && isPlainTextHost && onPasteBlocks) {
        onPasteBlocks([{ id: nid(), type: "image", src: pastedUrl, alt: "" }]);
        return;
      }
      const sel = window.getSelection();
      const esc = pastedUrl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      if (sel && !sel.isCollapsed && ref.current.contains(sel.anchorNode)) {
        document.execCommand("createLink", false, pastedUrl);
      } else {
        document.execCommand("insertHTML", false, `<a href="${esc}">${esc}</a>`);
      }
      handleInput();
      return;
    }

    if (onPasteBlocks) {
      // Prefer HTML clipboard (Notion, Google Docs, Word) — it has real structure
      if (clipHtml) {
        const blocks = parseHtmlBlocks(clipHtml);
        // Only use HTML path for structured content (multiple blocks, or a single
        // non-text block like numbers/bullets/table).  A single plain-text block
        // falls through to inline insertion so that pasting simple text inside a
        // list item never destroys the surrounding list via onReplaceBlock.
        const useful = blocks.filter(b => {
          if (b.type === "text") return (b.text || "").trim().length > 0;
          if (b.type === "bullets" || b.type === "numbers" || b.type === "checklist")
            return (b.items || []).some(i => (i.text || "").trim().length > 0);
          return true;
        });
        const isStructured = useful.length > 1 || (useful.length === 1 && useful[0].type !== "text");
        if (isStructured) {
          onPasteBlocks(useful, useful[0]?.id);
          return;
        }
      }
      // Fall back to plain-text / markdown parsing — but only when the result is
      // genuinely structured (multiple blocks or a single non-text block).
      // Multi-line plain text that parses to a single text block falls through to
      // inline insertion rather than replacing the surrounding list block.
      if (text.includes("\n") || text.includes("\t") || /^(#{1,3}|[-*•]\s|(\d+|[a-z]|[ivx]{1,5})[.)]\s|>\s|\|)/im.test(text.trim())) {
        const blocks = parseMarkdownishBlocks(text);
        const hasStructure = blocks.length > 1 || (blocks.length === 1 && blocks[0].type !== "text");
        if (hasStructure) {
          onPasteBlocks(blocks, blocks[0]?.id);
          return;
        }
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

  // contentEditable swallows link clicks by default — make anchors actually
  // clickable ("clickable links inside text"). href is re-validated at click
  // time so a stale/forged anchor can never reach window.open unchecked.
  const handleClick = (e) => {
    const a = e.target?.closest?.("a[href]");
    if (!a || !ref.current?.contains(a)) return;
    const href = window.safeUrl ? window.safeUrl(a.getAttribute("href")) : "";
    if (!href) return;
    e.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
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
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onClick={handleClick}
      data-placeholder={placeholder || ""}
      className="editable"
      style={{ whiteSpace:"pre-wrap", ...style }}
      spellCheck={false}
    />
  );
}
window.EditableText = EditableText;

// ====== SLASH MENU ======
function makeContentShootingBlocks() {
  const h = (text) => ({ id: nid(), type:"heading", level:1, text });
  const txt = () => ({ id: nid(), type:"text", text:"" });
  const todo = () => ({ id: nid(), type:"checklist", items:[{ id: nid(), text:"", done:false, dueDate:"" }] });
  return [
    h("Topic and Core Direction"),
    txt(),
    h("Raw Script"),
    txt(),
    h("Script Details and Checklist"),
    {
      id: nid(),
      type: "content-shooting-table",
      columns: ["Actor","Scene Location","Script","Shot Idea","Equipment Required","Reel Time","Others"],
      columnWidths: [90, 140, 200, 120, 130, 90, 100],
      rows: [
        { id: nid(), checked: false, cells: ["","","","","","",""] },
        { id: nid(), checked: false, cells: ["","","","","","",""] },
        { id: nid(), checked: false, cells: ["","","","","","",""] },
      ],
    },
    h("Equipment Checklist"),
    todo(),
    h("Places to Visit"),
    todo(),
    h("Caption"),
    txt(),
    h("Thumbnail Title (Optional)"),
    txt(),
  ];
}

const BUILT_IN_TEMPLATES = [
  {
    id: "builtin_content_shooting",
    name: "Content Shooting",
    icon: "🎬",
    makeBlocks: makeContentShootingBlocks,
  },
];

// Available commands (the slash menu)
const SLASH_COMMANDS = [
  { keys:["template","tpl"], label:"Template", icon:"❏", openTemplate: true, make: () => null },
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
  { keys:["image","img","picture","photo"], label:"Image from URL", icon:"🖼", make: () => ({ id: nid(), type:"image", src:"", alt:"" }) },
  { keys:["callout","quote"], label:"Callout", icon:"💡", make: () => ({ id: nid(), type:"callout", icon:"💡", text:"" }) },
  { keys:["divider","hr","line"], label:"Divider", icon:"—", make: () => ({ id: nid(), type:"divider" }) },
  {
    keys:["content-shoot","shoot","content shoot","shooting","reel","script"],
    label:"Content Shooting",
    icon:"🎬",
    // makeMany returns an array of blocks — this is a multi-block template
    makeMany: makeContentShootingBlocks,
    // Fallback make() in case old code calls it (creates placeholder block)
    make: () => ({ id: nid(), type:"content-shooting-table",
      columns: ["Actor","Scene Location","Script","Shot Idea","Equipment Required","Reel Time","Others"],
      columnWidths: [90, 140, 200, 120, 130, 90, 100],
      rows: [
        { id: nid(), checked: false, cells: ["","","","","","",""] },
        { id: nid(), checked: false, cells: ["","","","","","",""] },
        { id: nid(), checked: false, cells: ["","","","","","",""] },
      ],
    }),
  },
];

const TRAILING_TEXT_BLOCK_TYPES = new Set(["callout", "table", "divider", "milestones", "kpis", "calendar", "progress", "content-shooting-table"]);
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
  const [subOpen, setSubOpen] = useState(false);
  const [subRect, setSubRect] = useState({ left: 0, top: 0 });
  const [savedTemplates, setSavedTemplates] = useState([]);
  const menuRef = useRef(null);
  const filtered = SLASH_COMMANDS.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase().replace(/^\//, "");
    return c.keys.some(k => k.startsWith(q)) || c.label.toLowerCase().includes(q);
  });

  useEffect(() => { setActive(0); setSubOpen(false); }, [query]);

  // Load saved templates (for the Template submenu) whenever the menu opens.
  useEffect(() => {
    try { setSavedTemplates(JSON.parse(localStorage.getItem("workspace_v4_templates") || "[]")); } catch { setSavedTemplates([]); }
  }, []);

  const openSub = (btnEl) => {
    if (!btnEl) return;
    const r = btnEl.getBoundingClientRect();
    // Open to the right; flip left if it would overflow the viewport.
    let left = r.right + 6;
    if (left + 248 > window.innerWidth) left = Math.max(8, r.left - 248);
    setSubRect({ left, top: r.top });
    setSubOpen(true);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); setSubOpen(false); setActive(a => Math.min(a + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); setSubOpen(false); setActive(a => Math.max(a - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (filtered[active]) onPick(filtered[active]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); subOpen ? setSubOpen(false) : onClose(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [filtered, active, onPick, onClose, subOpen]);

  // Click outside the menu → dismiss it and leave the "/" as literal typed text.
  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [onClose]);

  if (filtered.length === 0) return null;
  // Use viewport-relative coordinates + position:fixed so the menu
  // is never clipped by the scrollable page-main container.
  const top = (anchorRect?.bottom || 0) + 4;
  const left = (anchorRect?.left || 0);
  return (
    <div className="slash-menu-root" ref={menuRef}>
      <div className="slash-menu" style={{ top, left, position: "fixed" }}>
        <div className="slash-hint">Insert block</div>
        {filtered.map((c, i) => (
          <button
            key={c.label}
            onMouseDown={(e) => { e.preventDefault(); if (c.openTemplate) { openSub(e.currentTarget); } else { onPick(c); } }}
            onMouseEnter={(e) => { setActive(i); if (c.openTemplate) openSub(e.currentTarget); else setSubOpen(false); }}
            className={`slash-item ${i === active ? "active" : ""}`}
          >
            <span className="slash-icon">{c.icon}</span>
            <span>{c.label}</span>
            {c.openTemplate && <span className="slash-item-arrow">›</span>}
          </button>
        ))}
        <div className="slash-footer">↑↓ navigate · ↵ select · esc dismiss</div>
      </div>
      {subOpen && (
        <div className="slash-submenu" style={{ left: subRect.left, top: subRect.top }}>
          {BUILT_IN_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              className="slash-sub-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick({ openTemplate: true, template: { name: tpl.name, blocks: tpl.makeBlocks() }, label: tpl.name });
              }}
            >
              <span className="slash-icon" style={{ fontSize: 13 }}>{tpl.icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</span>
              <span className="slash-sub-meta">Built-in</span>
            </button>
          ))}
          {savedTemplates.length === 0 ? (
            <div className="slash-submenu-empty">No saved templates yet.<br/>Save a page as a template first.</div>
          ) : savedTemplates.map((tpl) => (
            <button
              key={tpl.id}
              className="slash-sub-item"
              onMouseDown={(e) => { e.preventDefault(); onPick({ openTemplate: true, template: tpl, label: tpl.name }); }}
            >
              <span className="slash-icon" style={{ fontSize: 13 }}>❏</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</span>
              <span className="slash-sub-meta">{(tpl.blocks || []).length}</span>
            </button>
          ))}
        </div>
      )}
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

const MAX_LIST_LEVEL = 5;
const listLevel = (item) => Math.max(0, Math.min(MAX_LIST_LEVEL, Number(item?.level ?? (item?.indent ? 1 : 0)) || 0));
// Markers cycle every 3 levels (Google-Docs style): 1. → a. → i. → 1. → a. → i.
const markerForNumberLevel = (level, ordinal) => {
  const style = Math.max(0, level) % 3;
  if (style === 1) {
    // a..z, then aa, ab… for ordinals past 26
    let n = ordinal, s = "";
    while (n > 0) { n -= 1; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
    return `${s}.`;
  }
  if (style === 2) {
    const toRoman = (n) => {
      const map = [[1000,"m"],[900,"cm"],[500,"d"],[400,"cd"],[100,"c"],[90,"xc"],[50,"l"],[40,"xl"],[10,"x"],[9,"ix"],[5,"v"],[4,"iv"],[1,"i"]];
      let out = "";
      for (const [v, sym] of map) { while (n >= v) { out += sym; n -= v; } }
      return out || "i";
    };
    return `${toRoman(ordinal)}.`;
  }
  return `${ordinal}.`;
};
const markerForBulletLevel = (level) => ["•", "◦", "▪"][Math.max(0, level) % 3] || "•";
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
// Click → opens the block action menu (dispatched as a window event so the
// PageEditor, which holds all block actions, can render it). Drag → reorder.
function BlockHandle({ blockId, onDragBlockStart, onDragBlockEnd }) {
  const draggedRef = useRef(false);
  return (
    <button
      className="block-handle"
      draggable
      onDragStart={(e) => {
        draggedRef.current = true;
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", blockId);
        onDragBlockStart?.(blockId);
      }}
      onDragEnd={(e) => { onDragBlockEnd?.(e); setTimeout(() => { draggedRef.current = false; }, 0); }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedRef.current) return; // ignore the click that ends a drag
        const rect = e.currentTarget.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent("block-handle-click", {
          detail: { blockId, x: rect.right, y: rect.bottom },
        }));
      }}
      title="Click for actions · drag to move"
      type="button"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <circle cx="5.5" cy="3.5" r="1.3"/><circle cx="10.5" cy="3.5" r="1.3"/>
        <circle cx="5.5" cy="8" r="1.3"/><circle cx="10.5" cy="8" r="1.3"/>
        <circle cx="5.5" cy="12.5" r="1.3"/><circle cx="10.5" cy="12.5" r="1.3"/>
      </svg>
    </button>
  );
}

// ====== TEXT BLOCK with slash detection ======
function TextBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onAddBlockBefore, onAddBlockAfter, onMarkdownShortcut, onSlashCommandShow, onSlashCommandHide, onReplaceBlock, isLast, autoFocus, focusKey = 0, focusAtStart = false, onMoveToPreviousBlock, onMoveToNextBlock, onMergeNextBlock }) {
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
        onEnter={(plainText, caretPos, split) => {
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
            return; // undefined = no DOM truncation needed
          } else {
            // Split at cursor: new block gets "after", current keeps "before".
            // Return headHtml so EditableText updates its own DOM immediately.
            const tailHtml = split?.after ?? "";
            const headHtml = split?.before ?? block.text;
            onAddBlockAfter(tailHtml);
            return headHtml;
          }
        }}
        onBackspaceEmpty={() => {
          if (stepBackIndent()) return;
          onDeleteEmpty?.();
        }}
        onBackspaceAtStart={() => {
          if (stepBackIndent()) return;
          // Merge with previous block if possible
          onMoveToPreviousBlock?.("merge-current");
        }}
        onMarkdownShortcut={onMarkdownShortcut}
        onPasteBlocks={(blocks, focusId) => onReplaceBlock?.(blocks, focusId)}
        onMoveToPreviousBlock={onMoveToPreviousBlock}
        onMoveToNextBlock={onMoveToNextBlock}
        onDeleteAtEnd={() => onMergeNextBlock?.()}
        autoFocus={autoFocus}
        focusKey={focusKey}
        focusAtStart={focusAtStart}
        style={{ fontSize:16, color:"var(--text)", lineHeight:1.55, margin:"2px 0", minHeight:24 }}
      />
    </div>
  );
}

// ====== HEADING BLOCK ======
function HeadingBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteEmpty, onConvertToText, onAddBlockBefore, onAddBlockAfter, autoFocus, focusKey = 0, focusAtStart = false, onMoveToPreviousBlock, onMoveToNextBlock, onMergeNextBlock }) {
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
        onEnter={(_, caretPos, split) => {
          if (caretPos === 0 && !isBlankText(block.text)) {
            onAddBlockBefore?.();
            return;
          } else {
            const tailHtml = split?.after ?? "";
            const headHtml = split?.before ?? block.text;
            onAddBlockAfter(tailHtml);
            return headHtml; // EditableText truncates its DOM immediately
          }
        }}
        onBackspaceEmpty={() => isBlankText(block.text) ? onConvertToText?.("") : onDeleteEmpty?.()}
        onBackspaceAtStart={() => onConvertToText?.(block.text || "")}
        onMoveToPreviousBlock={onMoveToPreviousBlock}
        onMoveToNextBlock={onMoveToNextBlock}
        onDeleteAtEnd={() => onMergeNextBlock?.()}
        autoFocus={autoFocus}
        focusKey={focusKey}
        focusAtStart={focusAtStart}
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
function BulletsBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, patchBlock, onDeleteEmpty, onConvertToText, onReplaceBlock, onAddBlockAfter, onExitBlock, autoFocus, onMoveToPreviousBlock, onMoveToNextBlock, onMergeNextBlock }) {
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
        {(block.items || []).map((item, index) => {
          const level = listLevel(item);
          const isFirst = index === 0;
          const isLast = index === block.items.length - 1;
          // Arrow up: first item → go to previous block; other items → go to previous item in list
          const handleMoveToPrev = isFirst ? onMoveToPreviousBlock : () => {
            const prevItem = block.items[index - 1];
            setFocusItemId(prevItem.id);
            setFocusKey(k => k + 1);
            setTimeout(() => {
              const row = document.querySelector(`[data-item-id="${prevItem.id}"]`);
              const el = row?.querySelector('.editable');
              if (!el) return;
              el.focus();
              try { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch(_) {}
            }, 0);
          };
          // Arrow down: last item → go to next block; other items → go to next item in list
          const handleMoveToNext = isLast ? onMoveToNextBlock : () => {
            const nextItem = block.items[index + 1];
            setFocusItemId(nextItem.id);
            setFocusKey(k => k + 1);
            setTimeout(() => {
              const row = document.querySelector(`[data-item-id="${nextItem.id}"]`);
              const el = row?.querySelector('.editable');
              if (!el) return;
              el.focus();
              try { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch(_) {}
            }, 0);
          };
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
              onEnter={(_, caretPos, split) => {
                if (isBlankText(item.text)) {
                  if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                  const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                  onReplaceBlock?.(lifted.blocks, lifted.focusId);
                  return;
                }
                if (caretPos === 0) { addBefore(item.id); return; }
                // Split text at cursor: current item gets head, new item gets tail
                const tailHtml = split?.after ?? "";
                const headHtml = split?.before ?? item.text;
                const newItemId = nid();
                const newItem = itemWithLevel({ id: newItemId, text: tailHtml, level });
                const updatedItems = block.items.map(i =>
                  i.id === item.id ? itemWithLevel({ ...i, text: headHtml }) : itemWithLevel(i)
                );
                updateBlock({ ...block, items: withItemInserted(updatedItems, item.id, newItem) });
                window._pendingCaretOffset = 0; // caret at START of the new line (like text blocks)
                setFocusItemId(newItemId);
                setFocusKey(k => k + 1);
              }}
              onTab={() => upd(item.id, { level: Math.min(MAX_LIST_LEVEL, level + 1) })}
              onShiftTab={() => upd(item.id, { level: Math.max(0, level - 1) })}
              onBackspaceEmpty={() => {
                if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                if (index > 0) {
                  const prevItem = block.items[index - 1];
                  preFocusEl(prevItem.id, false);
                  patchBlock(block.id, b => ({ ...b, items: b.items.filter(i => i.id !== item.id) }));
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              onBackspaceAtStart={() => {
                if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                if (index > 0) {
                  const prevItem = block.items[index - 1];
                  preFocusEl(prevItem.id, false);
                  patchBlock(block.id, b => {
                    const latestPrev = b.items.find(i => i.id === prevItem.id);
                    const latestCurr = b.items.find(i => i.id === item.id);
                    if (!latestPrev) return b;
                    const merged = (latestPrev.text || '') + (latestCurr?.text || item.text || '');
                    return { ...b, items: b.items.map(i => i.id === prevItem.id ? { ...i, text: merged } : i).filter(i => i.id !== item.id) };
                  });
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, item.text);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              onMoveToPreviousBlock={handleMoveToPrev}
              onMoveToNextBlock={handleMoveToNext}
              onDeleteAtEnd={() => {
                // Forward-Delete at end of an item pulls the NEXT item's text in;
                // at the end of the last item, merge the following block instead.
                if (!isLast) {
                  const nextItem = block.items[index + 1];
                  patchBlock(block.id, (b) => {
                    const a = b.items.find((i) => i.id === item.id);
                    const nx = b.items.find((i) => i.id === nextItem.id);
                    if (!a || !nx) return b;
                    return { ...b, items: b.items.map((i) => i.id === item.id ? { ...i, text: (a.text || "") + (nx.text || "") } : i).filter((i) => i.id !== nextItem.id) };
                  });
                  return;
                }
                onMergeNextBlock?.();
              }}
              onPasteBlocks={(pastedBlocks, focusId) => {
                if (pastedBlocks.length === 1 && pastedBlocks[0].type === "bullets") {
                  const newItems = (pastedBlocks[0].items || []).map(itemWithLevel);
                  const idx = block.items.findIndex(i => i.id === item.id);
                  const merged = [...block.items.slice(0, idx + 1), ...newItems, ...block.items.slice(idx + 1)];
                  updateBlock({ ...block, items: merged });
                  if (newItems.length) { setFocusItemId(newItems[0].id); setFocusKey(k => k + 1); }
                  return;
                }
                // Safety net: plain-text pastes become new list items at current level.
                if (pastedBlocks.length > 0 && pastedBlocks.every(b => b.type === "text")) {
                  const bLevel = Math.max(0, listLevel(item));
                  const newItems = pastedBlocks.map(b => itemWithLevel({ id: nid(), text: b.text || "", level: bLevel }));
                  const idx = block.items.findIndex(i => i.id === item.id);
                  const merged = [...block.items.slice(0, idx + 1), ...newItems, ...block.items.slice(idx + 1)];
                  updateBlock({ ...block, items: merged });
                  if (newItems.length) { setFocusItemId(newItems[0].id); setFocusKey(k => k + 1); }
                  return;
                }
                onReplaceBlock?.(pastedBlocks, focusId || pastedBlocks[0]?.id);
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
function NumbersBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, patchBlock, onDeleteEmpty, onConvertToText, onReplaceBlock, onAddBlockAfter, onExitBlock, autoFocus, onMoveToPreviousBlock, onMoveToNextBlock, onMergeNextBlock }) {
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
    const counter = new Array(MAX_LIST_LEVEL + 1).fill(0);
    const parentIdx = new Array(MAX_LIST_LEVEL + 1).fill(-1); // index of the most-recent item at level l-1
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
        {(block.items || []).map((item, idx) => {
          const level = listLevel(item);
          const isFirst = idx === 0;
          const isLast = idx === block.items.length - 1;
          const handleMoveToPrev = isFirst ? onMoveToPreviousBlock : () => {
            const prevItem = block.items[idx - 1];
            setFocusItemId(prevItem.id);
            setFocusKey(k => k + 1);
            setTimeout(() => {
              const row = document.querySelector(`[data-item-id="${prevItem.id}"]`);
              const el = row?.querySelector('.editable');
              if (!el) return;
              el.focus();
              try { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch(_) {}
            }, 0);
          };
          const handleMoveToNext = isLast ? onMoveToNextBlock : () => {
            const nextItem = block.items[idx + 1];
            setFocusItemId(nextItem.id);
            setFocusKey(k => k + 1);
            setTimeout(() => {
              const row = document.querySelector(`[data-item-id="${nextItem.id}"]`);
              const el = row?.querySelector('.editable');
              if (!el) return;
              el.focus();
              try { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch(_) {}
            }, 0);
          };
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
              onEnter={(_, caretPos, split) => {
                if (isBlankText(item.text)) {
                  if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                  const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                  onReplaceBlock?.(lifted.blocks, lifted.focusId);
                  return;
                }
                if (caretPos === 0) { addBefore(item.id); return; }
                // Split text at cursor
                const tailHtml = split?.after ?? "";
                const headHtml = split?.before ?? item.text;
                const newItemId = nid();
                const newItem = itemWithLevel({ id: newItemId, text: tailHtml, level });
                const updatedItems = block.items.map(i =>
                  i.id === item.id ? itemWithLevel({ ...i, text: headHtml }) : itemWithLevel(i)
                );
                updateBlock({ ...block, items: withItemInserted(updatedItems, item.id, newItem) });
                window._pendingCaretOffset = 0; // caret at START of the new line (like text blocks)
                setFocusItemId(newItemId);
                setFocusKey(k => k + 1);
              }}
              onTab={() => upd(item.id, { level: Math.min(MAX_LIST_LEVEL, level + 1) })}
              onShiftTab={() => upd(item.id, { level: Math.max(0, level - 1) })}
              onBackspaceEmpty={() => {
                if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                if (idx > 0) {
                  const prevItem = block.items[idx - 1];
                  preFocusEl(prevItem.id, false);
                  patchBlock(block.id, b => ({ ...b, items: b.items.filter(i => i.id !== item.id) }));
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, "", level);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              onBackspaceAtStart={() => {
                if (level > 0) { upd(item.id, { level: level - 1 }); return; }
                if (idx > 0) {
                  const prevItem = block.items[idx - 1];
                  preFocusEl(prevItem.id, false);
                  patchBlock(block.id, b => {
                    const latestPrev = b.items.find(i => i.id === prevItem.id);
                    const latestCurr = b.items.find(i => i.id === item.id);
                    if (!latestPrev) return b;
                    const merged = (latestPrev.text || '') + (latestCurr?.text || item.text || '');
                    return { ...b, items: b.items.map(i => i.id === prevItem.id ? { ...i, text: merged } : i).filter(i => i.id !== item.id) };
                  });
                  return;
                }
                const lifted = liftListItemToTextBlocks(block, item.id, item.text);
                onReplaceBlock?.(lifted.blocks, lifted.focusId);
              }}
              onMoveToPreviousBlock={handleMoveToPrev}
              onMoveToNextBlock={handleMoveToNext}
              onDeleteAtEnd={() => {
                if (!isLast) {
                  const nextItem = block.items[idx + 1];
                  patchBlock(block.id, (b) => {
                    const a = b.items.find((i) => i.id === item.id);
                    const nx = b.items.find((i) => i.id === nextItem.id);
                    if (!a || !nx) return b;
                    return { ...b, items: b.items.map((i) => i.id === item.id ? { ...i, text: (a.text || "") + (nx.text || "") } : i).filter((i) => i.id !== nextItem.id) };
                  });
                  return;
                }
                onMergeNextBlock?.();
              }}
              onPasteBlocks={(pastedBlocks, focusId) => {
                if (pastedBlocks.length === 1 && pastedBlocks[0].type === "numbers") {
                  const newItems = (pastedBlocks[0].items || []).map(itemWithLevel);
                  const insertIdx = block.items.findIndex(i => i.id === item.id);
                  const merged = [...block.items.slice(0, insertIdx + 1), ...newItems, ...block.items.slice(insertIdx + 1)];
                  updateBlock({ ...block, items: merged });
                  if (newItems.length) { setFocusItemId(newItems[0].id); setFocusKey(k => k + 1); }
                  return;
                }
                // Safety net: if everything pasted is plain text, insert as new list
                // items at the current indent level rather than replacing the whole block.
                if (pastedBlocks.length > 0 && pastedBlocks.every(b => b.type === "text")) {
                  const newItems = pastedBlocks.map(b => itemWithLevel({ id: nid(), text: b.text || "", level }));
                  const insertIdx = block.items.findIndex(i => i.id === item.id);
                  const merged = [...block.items.slice(0, insertIdx + 1), ...newItems, ...block.items.slice(insertIdx + 1)];
                  updateBlock({ ...block, items: merged });
                  if (newItems.length) { setFocusItemId(newItems[0].id); setFocusKey(k => k + 1); }
                  return;
                }
                onReplaceBlock?.(pastedBlocks, focusId || pastedBlocks[0]?.id);
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
function ChecklistBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, patchBlock, onDeleteEmpty, onConvertToText, onReplaceBlock, onAddBlockAfter, onAddBlockBefore, onExitBlock, autoFocus, data, onMoveToPreviousBlock, onMoveToNextBlock, onMergeNextBlock }) {
  const [focusItemId, setFocusItemId] = useState(null);
  const [tableView, setTableView] = useState(block.tableView || false);
  const upd = (id, patch) => updateBlock({ ...block, items: (block.items||[]).map(i => i.id === id ? { ...i, ...patch } : i) });
  const addAfter = (id) => {
    const newItem = { id: nid(), text:"", done:false, dueDate:"" };
    updateBlock({ ...block, items: withItemInserted(block.items||[], id, newItem) });
    setFocusItemId(newItem.id);
  };
  const appendTask = () => {
    const newItem = { id: nid(), text:"", done:false, dueDate:"" };
    updateBlock({ ...block, items: [...(block.items || []), newItem] });
    setFocusItemId(newItem.id);
  };
  const addBefore = (id) => {
    const idx = (block.items||[]).findIndex(i => i.id === id);
    const newItem = { id: nid(), text:"", done:false, dueDate:"" };
    const next = [...(block.items||[])];
    next.splice(Math.max(0, idx), 0, newItem);
    updateBlock({ ...block, items: next });
    setFocusItemId(newItem.id);
  };
  const exitList = (id) => {
    const next = block.items.filter(i => i.id !== id && !isBlankText(i.text));
    onExitBlock?.({ ...block, items: next });
  };
  const rem = (id) => patchBlock(block.id, b => ({ ...b, items: b.items.filter(i => i.id !== id) }));
  const toggleView = () => {
    const next = !tableView;
    setTableView(next);
    updateBlock({ ...block, tableView: next });
  };

  const safeItems = block.items || [];
  const done = safeItems.filter(i => i.done).length;
  const total = safeItems.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const today = new Date().toISOString().slice(0,10);

  const sortedItems = tableView ? [...safeItems].sort((a, b) => {
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
          <button className="add-row-btn" onClick={() => { const its = block.items||[]; const last = its[its.length - 1]; last ? addAfter(last.id) : appendTask(); }}>+ task</button>
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
        {safeItems.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === safeItems.length - 1;
          const handleMoveToPrev = isFirst ? onMoveToPreviousBlock : () => {
            const prevItem = safeItems[index - 1];
            setFocusItemId(prevItem.id);
            setTimeout(() => {
              const row = document.querySelector(`[data-item-id="${prevItem.id}"]`);
              const el = row?.querySelector('.editable');
              if (!el) return;
              el.focus();
              try { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch(_) {}
            }, 0);
          };
          const handleMoveToNext = isLast ? onMoveToNextBlock : () => {
            const nextItem = block.items[index + 1];
            setFocusItemId(nextItem.id);
            setTimeout(() => {
              const row = document.querySelector(`[data-item-id="${nextItem.id}"]`);
              const el = row?.querySelector('.editable');
              if (!el) return;
              el.focus();
              try { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch(_) {}
            }, 0);
          };
          return (
          <div key={item.id} data-item-id={item.id} className={`check-row ${item.done ? "done" : ""}`}>
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
                onEnter={(_, caretPos, split) => {
                  if (isBlankText(item.text)) return safeItems.length === 1 && index === 0 ? addAfter(item.id) : exitList(item.id);
                  if (caretPos === 0) return addBefore(item.id);
                  const tailHtml = split?.after ?? "";
                  const headHtml = split?.before ?? item.text;
                  const newItemId = nid();
                  const newItem = { id: newItemId, text: tailHtml, done: false, dueDate: "" };
                  const updatedItems = safeItems.map(i => i.id === item.id ? { ...i, text: headHtml } : i);
                  updateBlock({ ...block, items: withItemInserted(updatedItems, item.id, newItem) });
                  window._pendingCaretOffset = 0; // caret at START of the new line (like text blocks)
                  setFocusItemId(newItemId);
                }}
                onBackspaceEmpty={() => safeItems.length > 1 ? rem(item.id) : onConvertToText?.("")}
                onBackspaceAtStart={() => {
                  const lifted = liftListItemToTextBlocks(block, item.id, item.text);
                  onReplaceBlock?.(lifted.blocks, lifted.focusId);
                }}
                onMoveToPreviousBlock={handleMoveToPrev}
                onMoveToNextBlock={handleMoveToNext}
                onDeleteAtEnd={() => {
                  if (!isLast) {
                    const nextItem = safeItems[index + 1];
                    patchBlock?.(block.id, (b) => {
                      const a = b.items.find((i) => i.id === item.id);
                      const nx = b.items.find((i) => i.id === nextItem.id);
                      if (!a || !nx) return b;
                      return { ...b, items: b.items.map((i) => i.id === item.id ? { ...i, text: (a.text || "") + (nx.text || "") } : i).filter((i) => i.id !== nextItem.id) };
                    });
                    return;
                  }
                  onMergeNextBlock?.();
                }}
                onPasteBlocks={(pastedBlocks, focusId) => {
                  if (pastedBlocks.length === 1 && pastedBlocks[0].type === "checklist") {
                    const newItems = (pastedBlocks[0].items || []).map(i => ({ id: nid(), text: i.text || "", done: !!i.done, dueDate: i.dueDate || "" }));
                    const insertIdx = (block.items || []).findIndex(i => i.id === item.id);
                    const merged = [...(block.items || []).slice(0, insertIdx + 1), ...newItems, ...(block.items || []).slice(insertIdx + 1)];
                    updateBlock({ ...block, items: merged });
                    if (newItems.length) setFocusItemId(newItems[0].id);
                    return;
                  }
                  onReplaceBlock?.(pastedBlocks, focusId || pastedBlocks[0]?.id);
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
          );
        })}
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
  // ── Kanban (board) view support ──────────────────────────────────────────
  const view = block.view === "kanban" ? "kanban" : "list";
  const setView = (v) => updateBlock({ ...block, view: v });
  const STATUS_ORDER = ["pending", "active", "done"];
  const moveStatus = (id, dir) => {
    const cur = block.items.find(i => i.id === id)?.status || "pending";
    let idx = STATUS_ORDER.indexOf(cur) + dir;
    idx = Math.max(0, Math.min(STATUS_ORDER.length - 1, idx));
    upd(id, { status: STATUS_ORDER[idx] });
  };
  const addTo = (status) => {
    const item = { id: nid(), name: "", status };
    updateBlock({ ...block, items: [...block.items, item] });
    setFocusItemId(item.id);
  };
  const totalMs = block.items.length;
  const doneMs  = block.items.filter(i => i.status === "done").length;
  const activeMs = block.items.filter(i => i.status === "active").length;
  const pctMs   = totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : 0;

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      <div className="milestone-toolbar">
        {totalMs > 0 && (
          <div className="milestone-header" style={{ flex: 1 }}>
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
        <div className="milestone-viewtoggle">
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} type="button">List</button>
          <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")} type="button">Board</button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="milestone-kanban">
          {STATUS_ORDER.map((status) => {
            const colItems = block.items.filter((i) => i.status === status);
            return (
              <div key={status} className="kanban-col">
                <div className={`kanban-col-head kanban-${status}`}>
                  <span>{ST[status].label}</span>
                  <span className="kanban-col-count">{colItems.length}</span>
                </div>
                <div className="kanban-col-body">
                  {colItems.map((item) => (
                    <div key={item.id} className="kanban-card">
                      <EditableText
                        value={item.name}
                        onChange={(v) => upd(item.id, { name: v })}
                        placeholder="Milestone"
                        multiline
                        autoFocus={focusItemId === item.id}
                        style={{ fontSize:13, fontWeight:500, color:"var(--text)", lineHeight:1.45 }}
                      />
                      <div className="kanban-card-tools">
                        <button type="button" title="Move left"  disabled={status === "pending"} onMouseDown={(e)=>e.preventDefault()} onClick={() => moveStatus(item.id, -1)}>‹</button>
                        <button type="button" title="Move right" disabled={status === "done"}    onMouseDown={(e)=>e.preventDefault()} onClick={() => moveStatus(item.id, 1)}>›</button>
                        <button type="button" title="Delete" className="row-del" onMouseDown={(e)=>e.preventDefault()} onClick={() => rem(item.id)}>×</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addTo(status)} className="kanban-add" type="button">+ add</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  );
}

// ====== TABLE ======
function TableBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock }) {
  const columnWidths = block.columnWidths || block.headers.map(() => 180);
  // Per-column type: "text" (default) or "checkbox". Checkbox cells store "1"/"".
  const colTypes = block.headers.map((_, i) => (block.colTypes || [])[i] || "text");
  const updateTable = (patch) => updateBlock({ ...block, ...patch });
  const updCell = (rid, ci, v) => updateBlock({ ...block, rows: block.rows.map(r => r.id === rid ? { ...r, cells: r.cells.map((c,i) => i === ci ? v : c) } : r) });
  const updHead = (i, v) => updateBlock({ ...block, headers: block.headers.map((h, idx) => idx === i ? v : h) });
  const toggleColType = (i) => {
    const next = [...colTypes];
    next[i] = next[i] === "checkbox" ? "text" : "checkbox";
    updateBlock({ ...block, colTypes: next });
  };
  const addRow = () => updateBlock({ ...block, columnWidths, rows: [...block.rows, { id: nid(), cells: block.headers.map(() => "") }] });
  const addCol = () => updateBlock({ ...block, headers: [...block.headers, "New"], colTypes: [...colTypes, "text"], columnWidths: [...columnWidths, 180], rows: block.rows.map(r => ({ ...r, cells: [...r.cells, ""] })) });
  const clearCell = (rid, ci) => updCell(rid, ci, "");
  const remRow = (id) => {
    const nextRows = block.rows.filter(r => r.id !== id);
    updateBlock({ ...block, rows: nextRows.length ? nextRows : [{ id: nid(), cells: block.headers.map(() => "") }] });
  };
  const remCol = (i) => {
    if (block.headers.length <= 1) return;
    updateBlock({ ...block, headers: block.headers.filter((_,idx) => idx !== i), colTypes: colTypes.filter((_, idx) => idx !== i), columnWidths: columnWidths.filter((_, idx) => idx !== i), rows: block.rows.map(r => ({ ...r, cells: r.cells.filter((_,idx) => idx !== i) })) });
  };
  const startResize = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[index] || 180;
    // Resolve the live <col> element so we can preview the new width during the drag
    // WITHOUT writing to React state / history on every mousemove (which floods sync
    // and creates one undo step per pixel). We commit a single update on mouseup.
    const colEl = e.target?.closest?.("table")?.querySelectorAll?.("colgroup col")?.[index] || null;
    let finalWidth = startWidth;
    const onMove = (ev) => {
      finalWidth = Math.max(80, startWidth + ev.clientX - startX);
      if (colEl) colEl.style.width = finalWidth + "px";
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      if (finalWidth !== startWidth) {
        const nextWidths = [...columnWidths];
        nextWidths[index] = finalWidth;
        updateTable({ columnWidths: nextWidths });
      }
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
                      style={{ flex:1, fontSize:11, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0, whiteSpace:"nowrap", overflow:"hidden" }}
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleColType(i); }}
                      className={`tbl-coltype${colTypes[i] === "checkbox" ? " tbl-coltype-on" : ""}`}
                      title={colTypes[i] === "checkbox" ? "Checkbox column — click for text" : "Make this a checkbox column"}
                      type="button"
                    >
                      ☑
                    </button>
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
                  <td key={i} className={colTypes[i] === "checkbox" ? "tbl-td-check" : ""}>
                    {colTypes[i] === "checkbox" ? (
                      <button
                        className={`tbl-checkcell${c ? " tbl-checked" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.stopPropagation(); updCell(row.id, i, c ? "" : "1"); }}
                        title={c ? "Mark incomplete" : "Mark complete"}
                        type="button"
                      >
                        {c ? "✓" : ""}
                      </button>
                    ) : (
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
                    )}
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
function CalendarBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock, data, setCurrentPage, updateEvents }) {
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

  // ── Real, editable calendar EVENTS (workspace-level data.events) ──────────
  const dayKeyOf = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const allEvents = Object.values(data?.events || {}).filter((ev) => ev && ev.date && ev.title);
  const eventsByDay = allEvents.reduce((acc, ev) => {
    if (ev.date.slice(0, 7) !== `${year}-${String(month + 1).padStart(2, "0")}`) return acc;
    const day = parseInt(ev.date.slice(8, 10), 10);
    acc[day] = [...(acc[day] || []), ev].sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
    return acc;
  }, {});

  // editor: null | { id?, title, date, time, notes, pageId, createdAt? }
  const [editor, setEditor] = React.useState(null);
  const canEdit = typeof updateEvents === "function";
  const openNewEvent = (day) => canEdit && setEditor({ title: "", date: dayKeyOf(day), time: "", notes: "", pageId: "" });
  const openEditEvent = (ev) => canEdit && setEditor({ ...ev });
  const saveEvent = () => {
    const title = (editor?.title || "").trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(editor?.date || "")) return;
    const id = editor.id || nid();
    const now = new Date().toISOString();
    updateEvents((evs) => ({
      ...evs,
      [id]: {
        id,
        title,
        date: editor.date,
        time: editor.time || "",
        notes: (editor.notes || "").slice(0, 2000),
        pageId: editor.pageId || "",
        createdAt: editor.createdAt || now,
        updatedAt: now,
      },
    }));
    setEditor(null);
  };
  const deleteEvent = (id) => {
    updateEvents((evs) => {
      const next = { ...evs };
      delete next[id];
      return next;
    });
    setEditor(null);
  };
  const linkablePages = Object.values(data?.pages || {})
    .filter((p) => !p.system && reachableIds.has(p.id))
    .map((p) => ({ id: p.id, title: (window.stripHtml ? window.stripHtml(p.title || "") : (p.title || "")) || "Untitled" }));

  // Today marker (only highlight when viewing the current month).
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const todayDay = now.getDate();

  const shiftMonth = (delta) => {
    const d = new Date(year, month + delta, 1);
    updateBlock({ ...block, month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01` });
  };
  const goToday = () => {
    updateBlock({ ...block, month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01` });
  };

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      <div className="calendar-block">
        <div className="calendar-toolbar">
          <div className="calendar-title">{monthDate.toLocaleDateString(undefined, { month:"long", year:"numeric" })}</div>
          <div className="calendar-nav">
            <button className="calendar-nav-btn" type="button" onClick={() => shiftMonth(-1)} title="Previous month" aria-label="Previous month">‹</button>
            <button className="calendar-today-btn" type="button" onClick={goToday} title="Jump to current month">Today</button>
            <button className="calendar-nav-btn" type="button" onClick={() => shiftMonth(1)} title="Next month" aria-label="Next month">›</button>
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
        </div>
        <div className="calendar-grid">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
          {cells.map((day, index) => {
            const isToday = day && isCurrentMonth && day === todayDay;
            const dayPages = pagesByDay[day] || [];
            const dayEvents = eventsByDay[day] || [];
            return (
              <div key={`${day || "blank"}-${index}`} className={`calendar-cell ${day ? "" : "muted"} ${isToday ? "today" : ""}`}>
                {day && (
                  <div className="calendar-day-row">
                    <span className="calendar-day">{day}</span>
                    {dayPages.length + dayEvents.length > 0 && (
                      <span className="calendar-day-count" title={`${dayPages.length + dayEvents.length} on this day`}>{dayPages.length + dayEvents.length}</span>
                    )}
                    {canEdit && (
                      <button
                        className="calendar-add-event"
                        type="button"
                        title="Add event"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.stopPropagation(); openNewEvent(day); }}
                      >+</button>
                    )}
                  </div>
                )}
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    className="calendar-event-pill"
                    type="button"
                    onClick={() => openEditEvent(ev)}
                    title={`${ev.time ? ev.time + " · " : ""}${ev.title}${ev.notes ? "\n" + ev.notes : ""} — click to edit`}
                  >
                    {ev.time && <span className="calendar-event-time">{ev.time}</span>}
                    <span className="calendar-page-pill-title">{ev.title}</span>
                  </button>
                ))}
                {dayPages.map((page) => (
                  <button key={page.id} className="calendar-page-pill" onClick={() => setCurrentPage?.(page.id)} title={`Open "${window.stripHtml ? window.stripHtml(page.title || "") : (page.title || "Untitled")}"`}>
                    <span>{page.icon ? renderPageIcon(page.icon, 14) : "📄"}</span>
                    <span className="calendar-page-pill-title">{(window.stripHtml ? window.stripHtml(page.title || "") : (page.title || "")) || "Untitled"}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {editor && (
          <div className="cal-event-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditor(null); }}>
            <div className="cal-event-modal" onMouseDown={(e) => e.stopPropagation()}>
              <h3>{editor.id ? "Edit event" : "New event"}</h3>
              <input
                className="cal-event-input"
                autoFocus
                placeholder="Event title"
                value={editor.title}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") saveEvent(); if (e.key === "Escape") setEditor(null); }}
              />
              <div className="cal-event-row">
                <input
                  className="cal-event-input"
                  type="date"
                  value={editor.date}
                  onChange={(e) => setEditor({ ...editor, date: e.target.value })}
                />
                <input
                  className="cal-event-input"
                  type="time"
                  value={editor.time || ""}
                  onChange={(e) => setEditor({ ...editor, time: e.target.value })}
                />
              </div>
              <textarea
                className="cal-event-input cal-event-notes"
                placeholder="Notes (optional)"
                value={editor.notes || ""}
                onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
              />
              <select
                className="cal-event-input"
                value={editor.pageId || ""}
                onChange={(e) => setEditor({ ...editor, pageId: e.target.value })}
                title="Optionally link this event to a page"
              >
                <option value="">No linked page</option>
                {linkablePages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <div className="cal-event-actions">
                {editor.id && <button className="cal-event-btn cal-event-del" type="button" onClick={() => deleteEvent(editor.id)}>Delete</button>}
                {editor.pageId && data?.pages?.[editor.pageId] && (
                  <button className="cal-event-btn" type="button" onClick={() => { setCurrentPage?.(editor.pageId); setEditor(null); }}>Open page</button>
                )}
                <span style={{ flex: 1 }} />
                <button className="cal-event-btn" type="button" onClick={() => setEditor(null)}>Cancel</button>
                <button className="cal-event-btn cal-event-save" type="button" disabled={!(editor.title || "").trim()} onClick={saveEvent}>
                  {editor.id ? "Save" : "Add event"}
                </button>
              </div>
            </div>
          </div>
        )}
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

// ====== CONTENT SHOOTING TABLE ======
const DEFAULT_SHOOT_COLS  = ["Actor","Scene Location","Script","Shot Idea","Equipment Required","Reel Time","Others"];
const DEFAULT_SHOOT_WIDTHS = [80, 140, 220, 120, 90, 80, 120];
const SCRIPT_COL_IDX = 2; // "Script" is always index 2 in the default layout

function ContentShootingTableBlock({ block, updateBlock, onDeleteBlock, blockId, onDragBlockStart, onDragBlockEnd }) {
  const cols = block.columns || DEFAULT_SHOOT_COLS;
  const rows = (block.rows || []).map((row) => ({
    ...row,
    cells: cols.map((_, i) => (row.cells || [])[i] || ""),
  }));
  const columnWidths = block.columnWidths || cols.map((_, i) => DEFAULT_SHOOT_WIDTHS[i] || 120);
  const [scriptPaste, setScriptPaste] = useState("");
  const [showScriptInput, setShowScriptInput] = useState(false);

  const updateTable = (patch) => updateBlock({ ...block, ...patch });

  const updCell = (rowId, ci, v) =>
    updateBlock({ ...block, rows: rows.map(r => r.id === rowId ? { ...r, cells: cols.map((_, i) => i === ci ? v : ((r.cells || [])[i] || "")) } : r) });

  const updHead = (i, v) =>
    updateBlock({ ...block, columns: cols.map((h, idx) => idx === i ? v : h) });

  const toggleRow = (rowId) =>
    updateBlock({ ...block, rows: rows.map(r => r.id === rowId ? { ...r, checked: !r.checked } : r) });

  const addRow = () =>
    updateBlock({ ...block, columnWidths, rows: [...rows, { id: nid(), checked: false, cells: cols.map(() => "") }] });

  const addCol = () =>
    updateBlock({ ...block, columns: [...cols, "New"], columnWidths: [...columnWidths, 120], rows: rows.map(r => ({ ...r, cells: [...r.cells, ""] })) });

  const remRow = (rowId) => {
    const next = rows.filter(r => r.id !== rowId);
    updateBlock({ ...block, rows: next.length ? next : [{ id: nid(), checked: false, cells: cols.map(() => "") }] });
  };

  const remCol = (i) => {
    if (cols.length <= 1) return;
    updateBlock({
      ...block,
      columns: cols.filter((_, idx) => idx !== i),
      columnWidths: columnWidths.filter((_, idx) => idx !== i),
      rows: rows.map(r => ({ ...r, cells: r.cells.filter((_, idx) => idx !== i) })),
    });
  };

  const startResize = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[index] || 120;
    // Preview width on the live <col> during drag; commit once on mouseup (see TableBlock).
    const colEl = e.target?.closest?.("table")?.querySelectorAll?.("colgroup col")?.[index] || null;
    let finalWidth = startWidth;
    const onMove = (ev) => {
      finalWidth = Math.max(50, startWidth + ev.clientX - startX);
      if (colEl) colEl.style.width = finalWidth + "px";
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      if (finalWidth !== startWidth) {
        const nextWidths = [...columnWidths];
        nextWidths[index] = finalWidth;
        updateTable({ columnWidths: nextWidths });
      }
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
  };

  const applyScriptPaste = () => {
    const chunks = scriptPaste
      .replace(/\r\n?/g, "\n")
      .split(/\n\s*\n+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    if (!chunks.length) return;
    const scriptIdx = Math.min(SCRIPT_COL_IDX, cols.length - 1);
    const newRows = chunks.map(chunk => ({
      id: nid(),
      checked: false,
      cells: cols.map((_, ci) => ci === scriptIdx ? sanitizeHtml(chunk).replace(/\n/g, "<br>") : ""),
    }));
    // Preserve any rows the user already filled in; only drop truly blank placeholder rows.
    const keep = rows.filter(r => (r.cells || []).some(c => (window.stripHtml ? window.stripHtml(c || "") : (c || "")).trim()));
    updateBlock({ ...block, rows: [...keep, ...newRows] });
    setScriptPaste("");
    setShowScriptInput(false);
  };

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />

      {/* Script paste zone */}
      <div style={{ marginBottom: 8 }}>
        {!showScriptInput ? (
          <button
            onClick={() => setShowScriptInput(true)}
            className="shoot-paste-btn"
          >
            📋 Paste script to auto-generate rows…
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              autoFocus
              value={scriptPaste}
              onChange={e => setScriptPaste(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); applyScriptPaste(); }
                if (e.key === "Escape") { e.preventDefault(); setShowScriptInput(false); setScriptPaste(""); }
              }}
              placeholder={"Paste your script here. Normal new lines stay in the same Script row; blank lines create new rows.\n\nExample:\nScene 1 line one\nScene 1 line two\n\nScene 2 line one"}
              className="shoot-paste-area"
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={applyScriptPaste} className="shoot-paste-apply">Generate rows</button>
              <button onClick={() => { setShowScriptInput(false); setScriptPaste(""); }} className="shoot-paste-cancel">Cancel</button>
              <span style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginLeft: 'auto' }}>
                {scriptPaste.replace(/\r\n?/g, "\n").split(/\n\s*\n+/).filter(l => l.trim()).length} rows · ⌘↵ to generate
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table — same visual style as TableBlock */}
      <div className="tbl-wrap">
        <table style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: 34 }} />
            {cols.map((_, i) => <col key={i} style={{ width: columnWidths[i] || 120 }} />)}
            <col style={{ width: 50 }} />
          </colgroup>
          <thead>
            <tr>
              {/* Fixed checkbox header */}
              <th>
                <div className="tbl-head" style={{ justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>✓</span>
                </div>
              </th>
              {cols.map((h, i) => (
                <th key={i}>
                  <div className="tbl-head">
                    <EditableText
                      value={h}
                      onChange={(v) => updHead(i, v)}
                      style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0, whiteSpace: "nowrap", overflow: "hidden" }}
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); remCol(i); }}
                      className="tbl-del"
                      title="Delete column"
                      type="button"
                    >×</button>
                  </div>
                  <span className="tbl-resize-handle" onMouseDown={(e) => startResize(i, e)} title="Resize column" />
                </th>
              ))}
              <th style={{ width: 50 }}>
                <button onClick={addCol} className="tbl-add">+</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ opacity: row.checked ? 0.45 : 1 }}>
                <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px' }}>
                  <input
                    type="checkbox"
                    checked={!!row.checked}
                    onChange={() => toggleRow(row.id)}
                    style={{ cursor: 'pointer', width: 14, height: 14 }}
                  />
                </td>
                {cols.map((_, i) => {
                  const c = row.cells[i] || "";
                  return (
                  <td key={i}>
                    <div className="tbl-cell-inner">
                      <EditableText
                        value={c}
                        onChange={(v) => updCell(row.id, i, v)}
                        placeholder="…"
                        multiline
                        softBreakOnEnter
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "var(--text)",
                          minHeight: 22,
                          paddingRight: 22,
                          textDecoration: row.checked ? 'line-through' : 'none',
                        }}
                      />
                      <button
                        className="tbl-cell-clear"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); updCell(row.id, i, ""); }}
                        title="Clear cell"
                        type="button"
                      >×</button>
                    </div>
                  </td>
                );})}
                <td style={{ textAlign: 'center', width: 30 }}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); remRow(row.id); }}
                    className="row-del"
                    title="Delete row"
                    type="button"
                  >×</button>
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

// ====== IMAGE (external URL) ======
function ImageBlock({ block, blockId, onDragBlockStart, onDragBlockEnd, updateBlock, onDeleteBlock }) {
  const src = safeUrl(block.src, { allowDataImage: true });
  const [draft, setDraft] = useState(block.src || "");
  const [broken, setBroken] = useState(false);
  const [editing, setEditing] = useState(!src);
  useEffect(() => { setBroken(false); }, [src]);

  const commit = () => {
    const clean = safeUrl(draft, { allowDataImage: true });
    if (!clean) {
      setDraft("");
      return; // unsafe / invalid URL — refuse silently, keep the prompt open
    }
    updateBlock({ ...block, src: clean });
    setEditing(false);
  };

  return (
    <div className="block-wrap">
      <BlockHandle blockId={blockId} onDragBlockStart={onDragBlockStart} onDragBlockEnd={onDragBlockEnd} />
      <BlockDeleteButton onDeleteBlock={onDeleteBlock} />
      {editing || !src ? (
        <div className="img-block-prompt">
          <span className="img-block-icon">🖼</span>
          <input
            className="img-block-input"
            placeholder="Paste an image URL (https://…)"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { src ? setEditing(false) : onDeleteBlock?.(); }
            }}
          />
          <button className="img-block-btn" type="button" onClick={commit} disabled={!safeUrl(draft, { allowDataImage: true })}>
            {safeUrl(draft, { allowDataImage: true }) || !draft.trim() ? "Embed" : "Unsafe URL"}
          </button>
        </div>
      ) : broken ? (
        <div className="img-block-prompt img-block-broken">
          <span className="img-block-icon">⚠️</span>
          <span style={{ flex: 1, fontSize: 13 }}>Image failed to load.</span>
          <button className="img-block-btn" type="button" onClick={() => { setDraft(block.src || ""); setEditing(true); }}>Change URL</button>
        </div>
      ) : (
        <div className="img-block">
          <img
            src={src}
            alt={(window.stripHtml ? window.stripHtml(block.alt || "") : (block.alt || "")) || "Image"}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
          <button
            className="img-block-edit"
            type="button"
            title="Change image URL"
            onClick={() => { setDraft(block.src || ""); setEditing(true); }}
          >✎</button>
        </div>
      )}
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

// Render functions — return a new element each call (JSX objects can't be shared/reused)
const makeSubpageDocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2h5.5L12 4.5V14H4V2z"/>
    <path d="M9 2v3h3"/>
  </svg>
);
const makeSubpageArrow = () => (
  <svg className="subpage-link-arrow" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4"/>
  </svg>
);

function SubpageBlock(props) {
  const { block, data, setCurrentPage } = props;
  const target = data?.pages?.[block.pageId];
  const exists = Boolean(target);
  const rawTitle = exists ? (target.title || "") : "";
  const title = (window.stripHtml ? window.stripHtml(rawTitle) : rawTitle).trim() || "Untitled";
  const icon = exists ? (target.icon || null) : null;
  const open = () => { if (exists) setCurrentPage?.(block.pageId); };
  return (
    <div className="block-wrap">
      <BlockHandle blockId={block.id} onDragBlockStart={props.onDragBlockStart} onDragBlockEnd={props.onDragBlockEnd} />
      {/* Only offer "remove" for a DEAD link (target page already deleted). While the
          sub-page exists, the link is managed automatically — delete the page to remove it. */}
      {!exists && <BlockDeleteButton onDeleteBlock={props.onDeleteBlock} title="Remove dead link" />}
      <div
        className={`subpage-link${exists ? "" : " missing"}`}
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
        title={exists ? `Open "${title}"` : "Linked page was deleted"}
      >
        <span className="subpage-link-icon">
          {exists ? (icon ? renderPageIcon(icon, 16) : makeSubpageDocIcon()) : "🗑️"}
        </span>
        <span className="subpage-link-title">{exists ? title : "Page deleted"}</span>
        {exists ? makeSubpageArrow() : null}
      </div>
    </div>
  );
}

function Block(props) {
  const [dropSide, setDropSide] = useState(null);
  const { block } = props;
  const isLocked = Boolean(props.lockedBy);
  const lockedEmail = props.lockedBy?.email || "";
  const lockedName = props.lockedBy?.displayName || "";
  const lockedPhoto = props.lockedBy?.photoURL || "";
  const lockedLabel = lockedName || lockedEmail || "Teammate";
  const avatarLetter = (lockedLabel[0] || "?").toUpperCase();
  const avatarBg = presenceColor(lockedEmail || lockedLabel);
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
    case "content-shooting-table": inner = <ContentShootingTableBlock {...childProps} />; break;
    case "subpage":    inner = <SubpageBlock {...childProps} />; break;
    case "image":      inner = <ImageBlock {...childProps} />; break;
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
        <div className="block-lock-badge" title={`${lockedLabel} is editing this block`}>
          {lockedPhoto
            ? <img className="presence-avatar presence-avatar-img" src={lockedPhoto} alt={avatarLetter} />
            : <span className="presence-avatar" style={{ background: avatarBg }}>{avatarLetter}</span>}
          <span className="block-lock-label">{lockedName || lockedEmail.split("@")[0] || "Teammate"}</span>
        </div>
      )}
    </div>
  );
}
window.Block = Block;
window.SLASH_COMMANDS = SLASH_COMMANDS;
