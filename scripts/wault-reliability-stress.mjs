import '../reliability-core.js';
import { readFileSync } from 'node:fs';

const R = globalThis.WaultReliability;
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

const workspaceAppSource = readFileSync(new URL('../workspace-app.jsx', import.meta.url), 'utf8');
const firebaseSyncSource = readFileSync(new URL('../firebase-sync.mjs', import.meta.url), 'utf8');
const databaseRulesSource = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
check(!workspaceAppSource.includes('DEV_PEEK'), 'localhost auth bypass is still present');
check(!workspaceAppSource.includes("sessionStorage.getItem('wn_session_id')"), 'browser tabs can still share a save-session id');
check(!/lower\.includes\(['"]connected['"]\)/.test(workspaceAppSource), 'connection state is still displayed as a confirmed save');
check(!firebaseSyncSource.includes('wernahhh@gmail.com'), 'retired owner email remains in Firebase client access control');
check(!databaseRulesSource.includes('wernahhh@gmail.com'), 'retired owner email remains in Firebase database rules');
check(databaseRulesSource.includes("auth.token.email === 'eewern21@gmail.com'"), 'owner-only Firebase rules are not tied to the canonical owner email');

console.log(`WAULT reliability stress passed: ${assertions} assertions`);
