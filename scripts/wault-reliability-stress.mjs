import '../reliability-core.js';
import '../workspace-export.js';
import { readFileSync } from 'node:fs';

const R = globalThis.WaultReliability;
const E = globalThis.WaultExport;
let assertions = 0;

function check(condition, label) {
  if (!condition) throw new Error(label);
  assertions += 1;
}

const task = (id, text, done = false) => ({ id, text, done });
const textBlock = (id, text) => ({ id, type: 'text', text });
const checklist = (id, items) => ({ id, type: 'checklist', items });
const page = (id, blocks, parentId = null) => ({ id, parentId, title: id, blocks });
const workspace = (pages, rootOrder = Object.keys(pages).filter((id) => !pages[id].parentId)) => ({
  pages,
  rootOrder,
  childOrder: {},
  currentPageId: rootOrder[0],
});

// The exact former data-loss race: save A must never clear or acknowledge newer B.
for (let index = 0; index < 10000; index += 1) {
  const saved = { index };
  const latest = index % 2 ? saved : { index: index + 1 };
  check(
    R.shouldFinalizeAcknowledgedSave(saved, { ws: 'stress', data: latest }, 'stress') === (saved === latest),
    `save acknowledgement race failed at ${index}`
  );
}

// Queued saves and realtime callbacks from a previous workspace must become
// inert as soon as the active/loaded workspace changes.
for (let index = 0; index < 5000; index += 1) {
  const workspaceId = `workspace-${index}`;
  check(R.workspaceContextMatches(workspaceId, workspaceId, workspaceId), `matching workspace context rejected at ${index}`);
  check(!R.workspaceContextMatches(workspaceId, `other-${index}`, workspaceId), `stale active workspace accepted at ${index}`);
  check(!R.workspaceContextMatches(workspaceId, workspaceId, `other-${index}`), `stale loaded workspace accepted at ${index}`);
  check(!R.shouldFinalizeAcknowledgedSave({ index }, { ws: `other-${index}`, data: { index } }, workspaceId), `cross-workspace save acknowledged at ${index}`);
}

const remoteTime = "2026-07-15T00:00:00.000Z";
const laterTime = "2026-07-15T00:00:01.000Z";
const earlierTime = "2026-07-14T23:59:59.000Z";
const draftData = workspace({ p: page('p', [textBlock('draft', 'draft')]) });
check(R.workspaceDataEqual(draftData, JSON.parse(JSON.stringify(draftData))), 'equal workspace snapshots were treated as an edit');
check(R.workspaceDataEqual(draftData, { ...draftData, currentPageId: 'another-local-page' }), 'local page navigation was treated as a shared edit');
check(!R.workspaceDataEqual(draftData, workspace({ p: page('p', [textBlock('draft', 'changed')]) })), 'changed workspace snapshot was treated as a no-op');
check(R.shouldReplayDraft({ data: draftData, savedAt: laterTime, baseUpdatedAt: remoteTime, baseRevision: 7 }, remoteTime, 7), 'matching-revision crash draft was not replayed');
check(!R.shouldReplayDraft({ data: draftData, savedAt: laterTime, baseUpdatedAt: remoteTime, baseRevision: 6 }, remoteTime, 7), 'stale-revision draft was replayed');
check(!R.shouldReplayDraft({ data: draftData, savedAt: earlierTime, baseUpdatedAt: remoteTime, baseRevision: 7 }, remoteTime, 7), 'older draft was replayed');
check(R.shouldReplayDraft({ data: draftData, savedAt: laterTime, baseUpdatedAt: remoteTime, baseRevision: 0 }, remoteTime, 0), 'matching legacy draft was not replayed');
check(!R.shouldReplayDraft({ data: draftData, savedAt: laterTime, baseUpdatedAt: earlierTime, baseRevision: 0 }, remoteTime, 0), 'stale legacy draft was replayed');

for (let index = 0; index < 2000; index += 1) {
  const base = workspace({ p: page('p', [textBlock('a', `base-${index}`), textBlock('b', `base-${index}`)]) });
  const local = workspace({ p: page('p', [textBlock('a', `local-${index}`), textBlock('b', `base-${index}`)]) });
  const remote = workspace({ p: page('p', [textBlock('a', `base-${index}`), textBlock('b', `remote-${index}`)]) });
  const merged = R.mergeWorkspaceConflict(base, local, remote);
  check(merged.pages.p.blocks.find((block) => block.id === 'a').text === `local-${index}`, `local block lost at ${index}`);
  check(merged.pages.p.blocks.find((block) => block.id === 'b').text === `remote-${index}`, `remote block lost at ${index}`);
}

const deleteBase = workspace({ p: page('p', [checklist('tasks', [task('one', 'One'), task('two', 'Two')])]) });
const deleteLocal = workspace({ p: page('p', [checklist('tasks', [task('two', 'Two')])]) });
const deleteRemote = workspace({ p: page('p', [checklist('tasks', [task('one', 'One edited'), task('two', 'Two'), task('three', 'Three')])]) });
const deleteMerged = R.mergeWorkspaceConflict(deleteBase, deleteLocal, deleteRemote);
const mergedItems = deleteMerged.pages.p.blocks[0].items;
check(!mergedItems.some((item) => item.id === 'one'), 'deleted checklist item resurrected');
check(mergedItems.some((item) => item.id === 'three'), 'concurrent checklist addition disappeared');

const parentA = page('a', [{ id: 'sub_child', type: 'subpage', pageId: 'child' }, textBlock('tail-a', '')]);
const parentB = page('b', [textBlock('tail-b', '')]);
const childAtB = page('child', [textBlock('child-text', 'content')], 'b');
let moved = R.normalizeParentSubpageLinks(workspace({ a: parentA, b: parentB, child: childAtB }, ['a', 'b']));
check(!moved.pages.a.blocks.some((block) => block.type === 'subpage' && block.pageId === 'child'), 'old parent kept moved subpage');
check(moved.pages.b.blocks.some((block) => block.type === 'subpage' && block.pageId === 'child'), 'new parent missed moved subpage');
moved = R.normalizeParentSubpageLinks({ ...moved, pages: { ...moved.pages, child: { ...moved.pages.child, parentId: null } }, rootOrder: ['a', 'b', 'child'] });
check(!Object.values(moved.pages).some((entry) => entry.blocks?.some((block) => block.type === 'subpage' && block.pageId === 'child')), 'root page retained a parent link');

check(!R.firebaseSaveSucceeded({ ok: false, blocked: true, reason: 'stale_revision' }), 'blocked save was treated as success');
check(R.firebaseSaveSucceeded({ ok: true, revision: 42 }), 'confirmed save was rejected');

const canonicalOwner = { uid: 'firebase-owner-uid', email: 'eewern21@gmail.com', role: 'owner', addedAt: '2026-07-22T00:00:00.000Z' };
const legacyOwner = { uid: 'eewern21_at_gmail_dot_com', email: 'eewern21@gmail.com', role: 'owner', addedAt: '2026-05-26T00:00:00.000Z' };
const teammate = { uid: 'member-uid', email: 'member@example.com', role: 'member' };
const dedupedMembers = R.dedupeTeamMembers([legacyOwner, teammate, canonicalOwner], canonicalOwner);
check(dedupedMembers.length === 2, 'team member email deduplication failed');
check(dedupedMembers.find((member) => member.email === canonicalOwner.email)?.uid === canonicalOwner.uid, 'legacy owner key replaced the real Firebase owner UID');
check(R.classifySyncStatus('Synced to cloud ✓')?.label === 'Saved', 'confirmed cloud sync was not labelled Saved');
check(R.classifySyncStatus('Saving to cloud…')?.label === 'Saving', 'active cloud save was not labelled Saving');
check(R.classifySyncStatus('Cloud refresh failed — not saving cache')?.label === 'Failed', 'cloud failure was not labelled Failed');
check(R.classifySyncStatus('Connected to cloud')?.label === 'Not synced', 'connection-only state was mislabelled as synced');
check(R.classifySyncStatus('Team catalogue loaded')?.label === 'Not synced', 'catalogue-only state was mislabelled as synced');

check(R.parseListPrefixShortcut('3.', 2)?.start === 3, 'explicit numbered-list start was not recognized');
check(R.parseListPrefixShortcut('10)', 3)?.start === 10, 'multi-digit numbered-list shortcut was not recognized');
check(R.parseListPrefixShortcut('- ', 2, true)?.type === 'bullets', 'bullet shortcut with inserted space was not recognized');
check(!R.parseListPrefixShortcut('item 3.', 7), 'number marker in normal text was misread as a list shortcut');

let listIdCounter = 0;
const makeListId = () => `list_${++listIdCounter}`;
const mixedNumberBlock = {
  id: 'numbers',
  type: 'numbers',
  items: [
    { id: 'one', text: 'One' },
    { id: 'two', text: 'Two' },
    { id: 'convert', text: '-' },
    { id: 'after', text: 'After' },
  ],
};
const bulletSplit = R.splitListBlockForShortcut(
  mixedNumberBlock,
  'convert',
  { type: 'bullets', remainingHtml: '' },
  makeListId
);
check(bulletSplit.blocks.map((block) => block.type).join(',') === 'numbers,bullets,numbers', 'mixed number/bullet blocks were not split in document order');
check(bulletSplit.blocks[0].items.map((item) => item.text).join(',') === 'One,Two', 'numbered rows before a bullet conversion changed');
check(bulletSplit.blocks[2].start === 3, 'numbering did not continue at 3 after an inserted bullet');
check(bulletSplit.blocks[2].items[0].text === 'After', 'numbered rows after a bullet conversion changed');

const resumedNumbers = R.splitListBlockForShortcut(
  {
    id: 'bullets',
    type: 'bullets',
    items: [
      { id: 'bullet-one', text: 'Bullet one' },
      { id: 'resume', text: '3.' },
    ],
  },
  'resume',
  { type: 'numbers', start: 3, remainingHtml: '' },
  makeListId
);
check(resumedNumbers.blocks.map((block) => block.type).join(',') === 'bullets,numbers', 'bullet-to-number continuation changed document order');
check(resumedNumbers.blocks[1].start === 3, 'numbered list did not resume at the explicit marker');

for (let index = 1; index <= 2000; index += 1) {
  const shortcut = R.parseListPrefixShortcut(`${index}.`, String(index).length + 1);
  check(shortcut?.type === 'numbers' && shortcut.start === index, `numbered shortcut failed at ${index}`);
}

const exportPage = {
  id: 'export-page',
  title: 'Readable Export',
  date: '2026-07-24',
  blocks: [
    { id: 'heading', type: 'heading', level: 1, text: 'Plan' },
    {
      id: 'numbers',
      type: 'numbers',
      start: 3,
      items: [
        { id: 'n3', text: 'Third', level: 0 },
        { id: 'n3a', text: 'Nested A', level: 1 },
        { id: 'n3b', text: 'Nested B', level: 1 },
        { id: 'n4', text: 'Fourth', level: 0 },
      ],
    },
    {
      id: 'bullets',
      type: 'bullets',
      items: [
        { id: 'b1', text: 'Bullet', level: 0 },
        { id: 'b2', text: 'Nested bullet', level: 1 },
      ],
    },
    {
      id: 'table',
      type: 'table',
      headers: ['Owner', 'Status'],
      rows: [{ id: 'row', cells: ['Ee Wern', 'Ready'] }],
    },
    {
      id: 'image',
      type: 'image',
      src: 'data:image/png;base64,AAAA',
      alt: 'Chart',
      caption: 'Company chart',
    },
  ],
};
const exportBody = E.renderPageBody(exportPage, {});
check(exportBody.includes('<ol start="3"'), 'PDF/Google export lost the numbered-list starting value');
check((exportBody.match(/<ol/g) || []).length === 2, 'nested numbered list was flattened during export');
check((exportBody.match(/<ul/g) || []).length === 2, 'nested bullet list was flattened during export');
check(exportBody.indexOf('Third') < exportBody.indexOf('Nested A') && exportBody.indexOf('Nested B') < exportBody.indexOf('Fourth'), 'export list order changed');
check(exportBody.includes('<thead><tr><th>Owner</th><th>Status</th></tr></thead>'), 'export table headers were lost');
check(exportBody.includes('<tbody><tr><td>Ee Wern</td><td>Ready</td></tr></tbody>'), 'export table rows were lost');
check(exportBody.includes('<figcaption>Company chart</figcaption>'), 'image caption was lost during export');
const printHtml = E.buildDocumentHtml(exportPage, { autoPrint: true });
const docsHtml = E.buildDocumentHtml(exportPage, { autoPrint: false });
check(printHtml.includes('@page { size: A4; margin: 18mm 17mm 20mm; }'), 'A4 export margins are missing');
check(printHtml.includes('font-size: 11pt'), 'readable export body font is missing');
check(printHtml.includes(exportBody) && docsHtml.includes(exportBody), 'PDF and Google Docs do not share the same document body');
check(printHtml.includes('window.print()') && !docsHtml.includes('window.print()'), 'Google Docs export contains print-only behavior');

for (let index = 1; index <= 1000; index += 1) {
  const html = E.renderList({
    type: 'numbers',
    start: index,
    items: [
      { id: `root-${index}`, text: `Root ${index}`, level: 0 },
      { id: `child-${index}`, text: `Child ${index}`, level: 1 },
      { id: `next-${index}`, text: `Next ${index}`, level: 0 },
    ],
  }, 'ol');
  check(html.includes(index > 1 ? `start="${index}"` : 'class="document-list'), `export numbering start failed at ${index}`);
  check((html.match(/<ol/g) || []).length === 2, `export nesting failed at ${index}`);
}

const workspaceAppSource = readFileSync(new URL('../workspace-app.jsx', import.meta.url), 'utf8');
const workspaceBlocksSource = readFileSync(new URL('../workspace-blocks.jsx', import.meta.url), 'utf8');
const bulletAndNumberSource = workspaceBlocksSource.slice(
  workspaceBlocksSource.indexOf('function BulletsBlock'),
  workspaceBlocksSource.indexOf('function ChecklistBlock')
);
const firebaseSyncSource = readFileSync(new URL('../firebase-sync.mjs', import.meta.url), 'utf8');
const databaseRulesSource = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
check(!workspaceAppSource.includes('DEV_PEEK'), 'localhost auth bypass is still present');
check(!workspaceAppSource.includes("sessionStorage.getItem('wn_session_id')"), 'browser tabs can still share a save-session id');
check(!/lower\.includes\(['"]connected['"]\)/.test(workspaceAppSource), 'connection state is still displayed as a confirmed save');
check(workspaceAppSource.includes('workspaceDataEqual(latest.data, remote)'), 'verified equal Firebase reads do not settle the save indicator');
check(!bulletAndNumberSource.includes('document.querySelector(`[data-item-id='), 'bullet/number caret targeting still uses a page-global row lookup');
check(workspaceBlocksSource.includes('replaceListItemFromShortcut'), 'mixed-list row conversion is not wired into the editor');
check(workspaceBlocksSource.includes('window.fileToDownscaledDataUrl = fileToDownscaledDataUrl'), 'image file dropping cannot use the safe image processor');
check(workspaceBlocksSource.includes('onPointerDown={startImageBlockDrag}'), 'images cannot be dragged directly between blocks');
check(workspaceAppSource.includes('onDropCapture={handleImageFileDrop}'), 'page editor does not accept dropped image files');
check(firebaseSyncSource.includes("driveProvider.addScope('https://www.googleapis.com/auth/drive.file')"), 'Google Docs export requests the wrong Drive permission');
check(firebaseSyncSource.includes('reauthenticateWithPopup(currentUser, driveProvider)'), 'Google Docs export can switch the signed-in WAULT account');
check(firebaseSyncSource.includes('uploadType=resumable'), 'large Google Docs exports do not use a resumable upload');
check(firebaseSyncSource.includes("method: 'PUT'"), 'large Google Docs export does not finish its resumable upload correctly');
check(!firebaseSyncSource.includes('wernahhh@gmail.com'), 'retired owner email remains in Firebase client access control');
check(!databaseRulesSource.includes('wernahhh@gmail.com'), 'retired owner email remains in Firebase database rules');
check(databaseRulesSource.includes("auth.token.email === 'eewern21@gmail.com'"), 'owner-only Firebase rules are not tied to the canonical owner email');

console.log(`WAULT reliability stress passed: ${assertions} assertions`);
