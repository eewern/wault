(function attachWaultExport(root) {
  "use strict";

  const ZW = /\u200b/g;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripHtml(value) {
    const raw = String(value == null ? "" : value).replace(ZW, "");
    if (typeof root.stripHtml === "function") return root.stripHtml(raw);
    return raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  function richText(value) {
    const raw = String(value == null ? "" : value).replace(ZW, "");
    if (typeof root.sanitizeHtml === "function") return root.sanitizeHtml(raw);
    return escapeHtml(stripHtml(raw)).replace(/\n/g, "<br>");
  }

  function safeImageUrl(value) {
    const url = String(value || "").trim();
    if (/^https?:\/\//i.test(url)) return url.replace(/"/g, "%22");
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url)) return url;
    return "";
  }

  function normalizeNumberStart(value) {
    const helper = root.WaultReliability?.normalizeNumberListStart;
    if (typeof helper === "function") return helper(value);
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 999999) : 1;
  }

  function itemLevel(item) {
    return Math.max(0, Math.min(8, Number(item?.level ?? (item?.indent ? 1 : 0)) || 0));
  }

  function listTree(items) {
    const source = (Array.isArray(items) ? items : []).filter(Boolean);
    if (!source.length) return [];
    const base = Math.min(...source.map(itemLevel));
    const roots = [];
    const lastAtLevel = [];
    let previousLevel = 0;

    source.forEach((item, index) => {
      let level = Math.max(0, itemLevel(item) - base);
      if (index === 0) level = 0;
      level = Math.min(level, previousLevel + 1);
      while (level > 0 && !lastAtLevel[level - 1]) level -= 1;

      const node = { item, children: [], level };
      if (level === 0) roots.push(node);
      else lastAtLevel[level - 1].children.push(node);

      lastAtLevel[level] = node;
      lastAtLevel.length = level + 1;
      previousLevel = level;
    });
    return roots;
  }

  function renderListNodes(nodes, tag, start, depth) {
    const startAttr = tag === "ol" && depth === 0 && start > 1 ? ` start="${start}"` : "";
    const typeClass = tag === "ol" ? "document-list-numbered" : "document-list-bulleted";
    const items = nodes.map((node) => {
      const nested = node.children.length
        ? renderListNodes(node.children, tag, 1, depth + 1)
        : "";
      return `<li><span>${richText(node.item.text) || "&nbsp;"}</span>${nested}</li>`;
    }).join("");
    return `<${tag}${startAttr} class="document-list ${typeClass} list-depth-${depth}">${items}</${tag}>`;
  }

  function renderList(block, tag) {
    const tree = listTree(block?.items);
    if (!tree.length) return "";
    return renderListNodes(tree, tag, tag === "ol" ? normalizeNumberStart(block.start) : 1, 0);
  }

  function renderTable(headers, rows, columnTypes) {
    const cleanHeaders = Array.isArray(headers) ? headers : [];
    const cleanRows = (Array.isArray(rows) ? rows : []).map((row) => (
      Array.isArray(row) ? row : (Array.isArray(row?.cells) ? row.cells : [])
    ));
    const width = Math.max(cleanHeaders.length, ...cleanRows.map((row) => row.length), 0);
    if (!width) return "";
    const types = Array.isArray(columnTypes) ? columnTypes : [];
    const cell = (value, index, tag) => {
      const content = types[index] === "checkbox"
        ? (String(value || "") === "1" ? "&#9745;" : "&#9744;")
        : (richText(value) || "&nbsp;");
      return `<${tag}>${content}</${tag}>`;
    };
    const head = cleanHeaders.length
      ? `<thead><tr>${Array.from({ length: width }, (_, index) => cell(cleanHeaders[index], index, "th")).join("")}</tr></thead>`
      : "";
    const body = cleanRows.length
      ? `<tbody>${cleanRows.map((row) => `<tr>${Array.from({ length: width }, (_, index) => cell(row[index], index, "td")).join("")}</tr>`).join("")}</tbody>`
      : "";
    return `<table class="document-table">${head}${body}</table>`;
  }

  function renderChecklist(block) {
    const items = (Array.isArray(block?.items) ? block.items : []).filter(Boolean);
    if (!items.length) return "";
    return `<ul class="document-checklist">${items.map((item) => {
      const box = item.done ? "&#9745;" : "&#9744;";
      const due = item.dueDate ? `<span class="checklist-date">${escapeHtml(item.dueDate)}</span>` : "";
      return `<li class="${item.done ? "is-done" : ""}"><span class="checklist-box">${box}</span><span>${richText(item.text) || "&nbsp;"}</span>${due}</li>`;
    }).join("")}</ul>`;
  }

  function renderKpis(block) {
    const items = (Array.isArray(block?.items) ? block.items : []).filter(Boolean);
    if (!items.length) return "";
    return `<table class="kpi-table"><tbody>${items.map((item) => {
      const target = item.target ? `<div class="kpi-target">Target: ${escapeHtml(item.target)}${escapeHtml(item.unit || "")}</div>` : "";
      const change = item.change ? `<div class="kpi-change">${escapeHtml(item.change)}</div>` : "";
      return `<tr><td><div class="kpi-label">${escapeHtml(stripHtml(item.label || "Metric"))}</div><div class="kpi-value">${escapeHtml(stripHtml(item.value || "0"))}${escapeHtml(item.unit || "")}</div>${target}${change}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function renderMilestones(block) {
    const items = (Array.isArray(block?.items) ? block.items : []).filter(Boolean);
    if (!items.length) return "";
    return `<table class="milestone-table"><tbody>${items.map((item) => {
      const status = String(item.status || "pending").replace(/-/g, " ");
      return `<tr><td class="milestone-status">${escapeHtml(status)}</td><td>${richText(item.name) || "&nbsp;"}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function renderProgress(block) {
    const total = Math.max(1, Number(block?.total) || 100);
    const value = Math.max(0, Math.min(total, Number(block?.value) || 0));
    const percent = Math.min(100, Math.round((value / total) * 100));
    return `<div class="progress-block"><div class="progress-heading"><strong>${escapeHtml(stripHtml(block?.label || "Progress"))}</strong><span>${percent}%</span></div><div class="progress-track"><span style="width:${percent}%"></span></div></div>`;
  }

  function renderBlock(block, data) {
    if (!block || !block.type) return "";
    switch (block.type) {
      case "heading": {
        const level = Math.max(1, Math.min(3, Number(block.level) || 1));
        return `<h${level + 1} class="content-heading">${richText(block.text) || "&nbsp;"}</h${level + 1}>`;
      }
      case "text": {
        const indent = Math.max(0, Math.min(4, Number(block.textIndentLevel) || 0));
        return `<p class="document-paragraph text-indent-${indent}">${richText(block.text) || "&nbsp;"}</p>`;
      }
      case "bullets":
        return renderList(block, "ul");
      case "numbers":
        return renderList(block, "ol");
      case "checklist":
        return renderChecklist(block);
      case "callout":
        return `<blockquote class="document-callout"><span class="callout-icon">${escapeHtml(block.icon || "")}</span><span>${richText(block.text) || "&nbsp;"}</span></blockquote>`;
      case "divider":
        return '<hr class="document-divider">';
      case "image": {
        const url = safeImageUrl(block.src);
        if (!url) return "";
        const caption = stripHtml(block.caption || "").trim();
        return `<figure class="document-image"><img src="${url}" alt="${escapeHtml(stripHtml(block.alt || "Image"))}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
      }
      case "table":
        return renderTable(block.headers, block.rows, block.colTypes);
      case "content-shooting-table":
        return renderTable(block.columns, block.rows, []);
      case "kpis":
        return renderKpis(block);
      case "milestones":
        return renderMilestones(block);
      case "progress":
        return renderProgress(block);
      case "calendar":
        return `<p class="calendar-summary"><strong>Calendar</strong>${block.month ? ` &middot; ${escapeHtml(block.month)}` : ""}</p>`;
      case "subpage": {
        const child = data?.pages?.[block.pageId];
        const title = stripHtml(child?.title || "Linked page").trim() || "Untitled";
        return `<p class="subpage-summary">&#128196; ${escapeHtml(title)}</p>`;
      }
      default:
        return "";
    }
  }

  function renderPageBody(page, data) {
    return (Array.isArray(page?.blocks) ? page.blocks : [])
      .map((block) => renderBlock(block, data))
      .filter(Boolean)
      .join("\n");
  }

  const DOCUMENT_CSS = `
    @page { size: A4; margin: 18mm 17mm 20mm; }
    * { box-sizing: border-box; }
    html { color: #202124; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; color: #202124; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.55; }
    .document-sheet { width: 100%; max-width: 176mm; margin: 0 auto; }
    .document-title { margin: 0 0 4pt; color: #111827; font-size: 24pt; line-height: 1.2; font-weight: 700; letter-spacing: 0; }
    .document-date { margin: 0 0 18pt; color: #68707c; font-size: 9.5pt; }
    .document-paragraph { margin: 0 0 8pt; min-height: 1em; widows: 2; orphans: 2; }
    .text-indent-1 { margin-left: 7mm; }
    .text-indent-2 { margin-left: 14mm; }
    .text-indent-3 { margin-left: 21mm; }
    .text-indent-4 { margin-left: 28mm; }
    .content-heading { color: #151922; font-weight: 700; break-after: avoid; page-break-after: avoid; letter-spacing: 0; }
    h2.content-heading { margin: 18pt 0 7pt; font-size: 17pt; line-height: 1.3; }
    h3.content-heading { margin: 15pt 0 6pt; font-size: 14pt; line-height: 1.35; }
    h4.content-heading { margin: 12pt 0 5pt; font-size: 11.5pt; line-height: 1.4; }
    .document-list { margin: 3pt 0 10pt; padding-left: 7mm; }
    .document-list .document-list { margin: 2pt 0 2pt; }
    .document-list li { margin: 1.5pt 0; padding-left: 1.5mm; widows: 2; orphans: 2; }
    .document-list-bulleted { list-style-type: disc; }
    .document-list-bulleted .document-list-bulleted { list-style-type: circle; }
    .document-list-bulleted .document-list-bulleted .document-list-bulleted { list-style-type: square; }
    .document-list-numbered { list-style-type: decimal; }
    .document-list-numbered .document-list-numbered { list-style-type: lower-alpha; }
    .document-list-numbered .document-list-numbered .document-list-numbered { list-style-type: lower-roman; }
    .document-checklist { margin: 3pt 0 10pt; padding: 0; list-style: none; }
    .document-checklist li { display: flex; gap: 6pt; align-items: baseline; margin: 2.5pt 0; }
    .document-checklist .is-done { color: #69717c; text-decoration: line-through; }
    .checklist-box { flex: 0 0 auto; font-family: Arial, Helvetica, sans-serif; }
    .checklist-date { margin-left: auto; color: #6b7280; font-size: 9pt; white-space: nowrap; }
    .document-callout { display: flex; gap: 8pt; margin: 10pt 0; padding: 9pt 11pt; border: 1px solid #d9dee7; border-left: 3pt solid #5b8def; background: #f6f8fb; break-inside: avoid; page-break-inside: avoid; }
    .callout-icon { flex: 0 0 auto; }
    .document-divider { margin: 15pt 0; border: 0; border-top: 0.75pt solid #d9dee5; }
    .document-image { margin: 11pt 0 13pt; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    .document-image img { display: block; max-width: 100%; max-height: 225mm; margin: 0 auto; object-fit: contain; }
    .document-image figcaption { margin-top: 5pt; color: #6b7280; font-size: 9pt; line-height: 1.4; }
    .document-table, .kpi-table, .milestone-table { width: 100%; margin: 10pt 0 13pt; border-collapse: collapse; table-layout: auto; font-size: 9.5pt; }
    .document-table thead { display: table-header-group; }
    .document-table tr, .kpi-table tr, .milestone-table tr { break-inside: avoid; page-break-inside: avoid; }
    .document-table th, .document-table td, .kpi-table td, .milestone-table td { padding: 5pt 6pt; border: 0.75pt solid #cfd5df; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    .document-table th { color: #303641; background: #eef1f5; font-weight: 700; }
    .kpi-label { color: #626b78; font-size: 8pt; font-weight: 700; text-transform: uppercase; }
    .kpi-value { color: #111827; font-size: 16pt; font-weight: 700; }
    .kpi-target, .kpi-change { color: #5f6875; font-size: 8.5pt; }
    .milestone-status { width: 28mm; color: #536173; text-transform: capitalize; }
    .progress-block { margin: 10pt 0 13pt; break-inside: avoid; page-break-inside: avoid; }
    .progress-heading { display: flex; justify-content: space-between; margin-bottom: 5pt; }
    .progress-track { height: 5pt; overflow: hidden; background: #e6eaf0; }
    .progress-track span { display: block; height: 100%; background: #5b8def; }
    .calendar-summary, .subpage-summary { margin: 8pt 0; padding: 7pt 9pt; border: 0.75pt solid #d9dee5; background: #fafbfc; break-inside: avoid; page-break-inside: avoid; }
    a { color: #2457a7; text-decoration: underline; }
    @media screen {
      body { padding: 18mm 17mm 20mm; }
      .document-sheet { min-height: 257mm; }
    }
    @media print {
      body { padding: 0; }
      .document-sheet { max-width: none; }
    }
  `;

  function buildDocumentHtml(page, options) {
    const settings = options || {};
    const title = stripHtml(page?.title || "Untitled").trim() || "Untitled";
    const icon = settings.icon || "";
    const autoPrint = settings.autoPrint === true;
    const printScript = autoPrint
      ? `<script>(function(){var images=Array.prototype.slice.call(document.images);var waits=images.map(function(img){if(img.complete)return Promise.resolve();return new Promise(function(resolve){img.addEventListener("load",resolve,{once:true});img.addEventListener("error",resolve,{once:true});});});Promise.race([Promise.all(waits),new Promise(function(resolve){setTimeout(resolve,4000);})]).then(function(){setTimeout(function(){window.print();},120);});})();<\/script>`
      : "";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
<article class="document-sheet">
<h1 class="document-title">${icon ? `${escapeHtml(icon)} ` : ""}${escapeHtml(title)}</h1>
${page?.date ? `<p class="document-date">${escapeHtml(page.date)}</p>` : ""}
${renderPageBody(page, settings.data)}
</article>
${printScript}
</body>
</html>`;
  }

  function safeFilename(value) {
    return (stripHtml(value || "Untitled").trim() || "Untitled")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 120);
  }

  root.WaultExport = Object.freeze({
    buildDocumentHtml,
    renderPageBody,
    renderList,
    safeFilename,
    DOCUMENT_CSS,
  });
})(typeof window !== "undefined" ? window : globalThis);
