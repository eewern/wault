import 'dotenv/config';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import '../reliability-core.js';

const DB = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
const configSource = readFileSync(new URL('../workspace-config.js', import.meta.url), 'utf8');
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || configSource.match(/firebaseApiKey:\s*["']([^"']+)/)?.[1] || '';
const R = globalThis.WaultReliability;

if (!DB || !WEB_API_KEY || !serviceAccount.client_email || !serviceAccount.private_key) {
  throw new Error('Firebase stress test requires FIREBASE_DATABASE_URL and FIREBASE_SERVICE_ACCOUNT_JSON.');
}

const base64Url = (value) => Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function serviceJwt(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    sub: account.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key);
  return `${header}.${claims}.${base64Url(signature)}`;
}

let accessToken = '';
let activeDatabaseToken = '';
async function token() {
  if (accessToken) return accessToken;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: serviceJwt(serviceAccount),
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`OAuth failed (${response.status})`);
  accessToken = payload.access_token;
  return accessToken;
}

async function request(path, { method = 'GET', body, etag = false, ifMatch, authToken = '' } = {}) {
  const firebaseIdToken = !authToken && activeDatabaseToken ? activeDatabaseToken : '';
  const headers = firebaseIdToken ? {} : { authorization: `Bearer ${authToken || await token()}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (etag) headers['X-Firebase-ETag'] = 'true';
  if (ifMatch) headers['If-Match'] = ifMatch;
  const authQuery = firebaseIdToken ? `?auth=${encodeURIComponent(firebaseIdToken)}` : '';
  const response = await fetch(`${DB}/${String(path).replace(/^\/+/, '')}.json${authQuery}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { ok: response.ok, status: response.status, data, etag: response.headers.get('etag') || '' };
}

function firebaseCustomToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(serviceAccount.private_key);
  return `${header}.${claims}.${base64Url(signature)}`;
}

async function signInSyntheticMember(uid) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: firebaseCustomToken(uid), returnSecureToken: true }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.idToken) throw new Error(`Synthetic Firebase sign-in failed (${response.status})`);
  return payload;
}

async function deleteSyntheticMember(idToken) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw new Error(`Synthetic Firebase user cleanup failed (${response.status})`);
}

async function requireOk(promise, label) {
  const result = await promise;
  if (!result.ok) throw new Error(`${label} failed (${result.status})`);
  return result;
}

let assertions = 0;
function check(condition, label) {
  if (!condition) throw new Error(label);
  assertions += 1;
}

const runId = `__wault_reliability_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const testUid = `waultStress_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const paths = {
  workspace: `workspaces/${runId}`,
  catalog: `workspaceCatalog/${runId}`,
  backups: `workspaceBackups/${runId}`,
  versions: `workspaceVersions/${runId}`,
  daily: `workspaceDailyExports/${runId}`,
  drafts: `workspaceDrafts/${runId}`,
  trash: `workspaceTrash/${runId}`,
  audit: `workspaceAuditLogs/${runId}`,
  focus: `focus/${testUid}`,
};
let syntheticAuth = null;

const textBlock = (id, text) => ({ id, type: 'text', text });
const checklist = (count) => ({
  id: 'tasks',
  type: 'checklist',
  items: Array.from({ length: count }, (_, index) => ({ id: `task_${index}`, text: `Task ${index}`, done: false })),
});
const baseWorkspace = {
  pages: {
    page: { id: 'page', parentId: null, title: 'Reliability Stress', blocks: [textBlock('a', 'base-a'), textBlock('b', 'base-b'), checklist(20)] },
  },
  rootOrder: ['page'],
  childOrder: {},
  currentPageId: 'page',
  settings: { workspaceName: 'Reliability Stress' },
  events: {},
};

const now = () => new Date().toISOString();
const makeRecord = (workspace, revision) => ({ workspace, updated_at: now(), source: 'firebase-stress', saveId: runId, revision });
const historyId = (label) => `${Date.now()}_${label}_${Math.random().toString(36).slice(2, 7)}`;

async function writeCanonical(previousRecord, nextWorkspace, currentEtag, label) {
  const backupId = historyId(`backup_${label}`);
  await requireOk(request(`${paths.backups}/${backupId}`, {
    method: 'PUT',
    body: { ...previousRecord, backed_up_at: now(), summary: { pages: 1 } },
  }), `${label} backup`);
  const nextRecord = makeRecord(nextWorkspace, Number(previousRecord.revision || 0) + 1);
  const saved = await request(paths.workspace, { method: 'PUT', body: nextRecord, ifMatch: currentEtag });
  if (!saved.ok) return saved;
  await Promise.all([
    requireOk(request(`${paths.versions}/${historyId(`version_${label}`)}`, {
      method: 'PUT',
      body: { ...nextRecord, summary: { pages: 1 } },
    }), `${label} version`),
    requireOk(request(`${paths.audit}/${historyId(`audit_${label}`)}`, {
      method: 'PUT',
      body: { action: 'workspace_update', created_at: now(), workspaceId: runId, revision: nextRecord.revision },
    }), `${label} audit`),
  ]);
  return { ...saved, data: nextRecord };
}

try {
  console.log(`Starting isolated Firebase reliability stress: ${runId}`);
  syntheticAuth = await signInSyntheticMember(testUid);
  await requireOk(request(`access/${testUid}`, {
    method: 'PUT',
    authToken: await token(),
    body: { email: `${testUid}@wault.test`, role: 'member', approvedAt: now() },
  }), 'synthetic member access grant');
  activeDatabaseToken = syntheticAuth.idToken;
  check((await requireOk(request(`access/${testUid}`), 'member access rule readback')).data.role === 'member', 'member could not read its access record');
  const memberDirectoryRead = await request('access');
  check(!memberDirectoryRead.ok, 'member could read the owner-only access directory');
  await requireOk(request(`access/${testUid}`, {
    method: 'PUT',
    authToken: await token(),
    body: { email: `${testUid}@wault.test`, role: 'owner', approvedAt: now() },
  }), 'synthetic owner promotion');
  const ownerDirectoryRead = await requireOk(request('access'), 'owner access directory read');
  check(ownerDirectoryRead.data?.[testUid]?.role === 'owner', 'owner could not read the approved member directory');
  check((await requireOk(request('signins'), 'owner sign-in directory read')).ok, 'owner could not read sign-in requests');
  check((await requireOk(request('blocked'), 'owner blocked directory read')).ok, 'owner could not read blocked accounts');
  await requireOk(request(`access/${testUid}`, {
    method: 'PUT',
    authToken: await token(),
    body: { email: `${testUid}@wault.test`, role: 'member', approvedAt: now() },
  }), 'synthetic member role restore');

  await requireOk(request(paths.catalog, {
    method: 'PUT',
    body: { id: runId, name: 'Reliability Stress', visibility: 'shared', updatedAt: now(), deleted: false },
  }), 'catalog create');
  await requireOk(request(paths.workspace, { method: 'PUT', body: makeRecord(baseWorkspace, 1) }), 'workspace create');

  const starting = await requireOk(request(paths.workspace, { etag: true }), 'workspace etag read');
  const localWorkspace = structuredClone(baseWorkspace);
  localWorkspace.pages.page.blocks.find((block) => block.id === 'a').text = 'local-a';
  const remoteWorkspace = structuredClone(baseWorkspace);
  remoteWorkspace.pages.page.blocks.find((block) => block.id === 'b').text = 'remote-b';
  const localRecord = makeRecord(localWorkspace, 2);
  const remoteRecord = makeRecord(remoteWorkspace, 2);
  const concurrent = await Promise.all([
    request(paths.workspace, { method: 'PUT', body: localRecord, ifMatch: starting.etag }),
    request(paths.workspace, { method: 'PUT', body: remoteRecord, ifMatch: starting.etag }),
  ]);
  check(concurrent.filter((result) => result.ok).length === 1, 'concurrent compare-and-swap allowed more than one winner');
  check(concurrent.filter((result) => result.status === 412).length === 1, 'stale concurrent write was not rejected');

  let current = await requireOk(request(paths.workspace, { etag: true }), 'post-conflict read');
  const losingWorkspace = concurrent[0].ok ? remoteWorkspace : localWorkspace;
  const mergedWorkspace = R.mergeWorkspaceConflict(baseWorkspace, losingWorkspace, current.data.workspace);
  const mergedSave = await writeCanonical(current.data, mergedWorkspace, current.etag, 'conflict_merge');
  check(mergedSave.ok, 'merged conflict retry failed');
  current = await requireOk(request(paths.workspace, { etag: true }), 'merged read');
  check(current.data.workspace.pages.page.blocks.find((block) => block.id === 'a').text === 'local-a', 'local concurrent edit disappeared');
  check(current.data.workspace.pages.page.blocks.find((block) => block.id === 'b').text === 'remote-b', 'remote concurrent edit disappeared');

  for (let round = 0; round < 20; round += 1) {
    const base = structuredClone(current.data.workspace);
    const clientA = structuredClone(base);
    const clientB = structuredClone(base);
    clientA.pages.page.blocks.find((block) => block.id === 'a').text = `client-a-${round}`;
    clientB.pages.page.blocks.find((block) => block.id === 'b').text = `client-b-${round}`;
    const nextRevision = Number(current.data.revision || 0) + 1;
    const pair = await Promise.all([
      request(paths.workspace, { method: 'PUT', body: makeRecord(clientA, nextRevision), ifMatch: current.etag }),
      request(paths.workspace, { method: 'PUT', body: makeRecord(clientB, nextRevision), ifMatch: current.etag }),
    ]);
    check(pair.filter((result) => result.ok).length === 1, `cross-client round ${round} had the wrong winner count`);
    check(pair.filter((result) => result.status === 412).length === 1, `cross-client round ${round} did not reject the stale writer`);
    current = await requireOk(request(paths.workspace, { etag: true }), `cross-client read ${round}`);
    const loser = pair[0].ok ? clientB : clientA;
    const merged = R.mergeWorkspaceConflict(base, loser, current.data.workspace);
    const retried = await writeCanonical(current.data, merged, current.etag, `cross_client_${round}`);
    check(retried.ok, `cross-client merge retry ${round} failed`);
    current = await requireOk(request(paths.workspace, { etag: true }), `cross-client merged read ${round}`);
    check(current.data.workspace.pages.page.blocks.find((block) => block.id === 'a').text === `client-a-${round}`, `client A edit disappeared in round ${round}`);
    check(current.data.workspace.pages.page.blocks.find((block) => block.id === 'b').text === `client-b-${round}`, `client B edit disappeared in round ${round}`);
  }

  for (let index = 0; index < 30; index += 1) {
    const next = structuredClone(current.data.workspace);
    next.pages.page.blocks.find((block) => block.id === 'a').text = `rapid-${index}`;
    const saved = await writeCanonical(current.data, next, current.etag, `rapid_${index}`);
    check(saved.ok, `rapid save ${index} failed`);
    current = await requireOk(request(paths.workspace, { etag: true }), `rapid read ${index}`);
  }

  const beforeDeletes = { data: structuredClone(current.data), etag: current.etag };
  for (let index = 0; index < 20; index += 1) {
    const next = structuredClone(current.data.workspace);
    const taskBlock = next.pages.page.blocks.find((block) => block.id === 'tasks');
    taskBlock.items = taskBlock.items.filter((item) => item.id !== `task_${index}`);
    const saved = await writeCanonical(current.data, next, current.etag, `delete_${index}`);
    check(saved.ok, `checklist delete ${index} failed`);
    current = await requireOk(request(paths.workspace, { etag: true }), `delete read ${index}`);
  }
  check((current.data.workspace.pages.page.blocks.find((block) => block.id === 'tasks').items || []).length === 0, 'deleted checklist items resurrected');

  const staleEditor = structuredClone(beforeDeletes.data.workspace);
  staleEditor.pages.page.blocks.find((block) => block.id === 'a').text = 'stale-editor-kept-typing';
  const rejectedStaleEditor = await request(paths.workspace, {
    method: 'PUT',
    body: makeRecord(staleEditor, Number(beforeDeletes.data.revision || 0) + 1),
    ifMatch: beforeDeletes.etag,
  });
  check(rejectedStaleEditor.status === 412, 'stale editor rewrote checklist deletions');
  const deleteSafeMerge = R.mergeWorkspaceConflict(beforeDeletes.data.workspace, staleEditor, current.data.workspace);
  const deleteSafeSave = await writeCanonical(current.data, deleteSafeMerge, current.etag, 'stale_editor_delete_merge');
  check(deleteSafeSave.ok, 'delete-safe stale editor merge failed');
  current = await requireOk(request(paths.workspace, { etag: true }), 'delete-safe merged read');
  check((current.data.workspace.pages.page.blocks.find((block) => block.id === 'tasks').items || []).length === 0, 'stale editor merge resurrected deleted checklist items');
  check(current.data.workspace.pages.page.blocks.find((block) => block.id === 'a').text === 'stale-editor-kept-typing', 'stale editor text was lost while preserving deletes');

  await requireOk(request(`${paths.drafts}/${testUid}`, {
    method: 'PUT',
    body: { workspace: current.data.workspace, saved_at: now(), base_updated_at: current.data.updated_at, base_revision: current.data.revision, saveId: runId },
  }), 'draft write');
  const draft = await requireOk(request(`${paths.drafts}/${testUid}`), 'draft read');
  check(draft.data.base_revision === current.data.revision, 'draft revision readback mismatch');

  const focusTasks = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`focus_${index}`, {
    id: `focus_${index}`,
    title: `Focus ${index}`,
    status: 'todo',
    createdAt: now(),
    updatedAt: now(),
  }]));
  await requireOk(request(`${paths.focus}/tasks`, { method: 'PUT', body: focusTasks }), 'focus batch create');
  await Promise.all(Object.keys(focusTasks).map((taskId) => requireOk(request(`${paths.focus}/tasks/${taskId}`, { method: 'DELETE' }), `focus delete ${taskId}`)));
  const focusAfterDelete = await requireOk(request(`${paths.focus}/tasks`), 'focus delete readback');
  check(focusAfterDelete.data === null, 'Focus tasks remained after delete');

  await requireOk(request(`${paths.daily}/${now().slice(0, 10)}`, {
    method: 'PUT',
    body: { ...current.data, summary: { pages: 1 } },
  }), 'daily export');
  await requireOk(request(`${paths.trash}/${historyId('trash')}`, {
    method: 'PUT',
    body: { ...current.data, deleted_at: now(), summary: { pages: 1 } },
  }), 'trash snapshot');
  const tombstone = { ...current.data, deleted: true, deleted_at: now(), revision: Number(current.data.revision || 0) + 1 };
  await requireOk(request(paths.workspace, { method: 'PUT', body: tombstone, ifMatch: current.etag }), 'soft delete');
  await requireOk(request(paths.catalog, {
    method: 'PUT',
    body: { id: runId, name: 'Reliability Stress', visibility: 'shared', updatedAt: now(), deleted: true },
  }), 'catalog tombstone');
  const trash = await requireOk(request(paths.trash), 'trash verification');
  check(Object.keys(trash.data || {}).length >= 1, 'soft delete had no recovery snapshot');

  console.log(`Firebase reliability stress passed: ${assertions} assertions`);
} finally {
  activeDatabaseToken = '';
  const serviceToken = await token().catch(() => '');
  await Promise.all([
    ...Object.values(paths).map((path) => request(path, { method: 'DELETE', authToken: serviceToken }).catch(() => null)),
    request(`access/${testUid}`, { method: 'DELETE', authToken: serviceToken }).catch(() => null),
  ]);
  const [workspaceGone, catalogGone, accessGone, focusGone] = await Promise.all([
    request(paths.workspace, { authToken: serviceToken }),
    request(paths.catalog, { authToken: serviceToken }),
    request(`access/${testUid}`, { authToken: serviceToken }),
    request(paths.focus, { authToken: serviceToken }),
  ]);
  let cleanupError = null;
  if (workspaceGone.data !== null || catalogGone.data !== null) cleanupError = new Error(`Synthetic cleanup failed for ${runId}`);
  if (accessGone.data !== null || focusGone.data !== null) cleanupError = new Error(`Synthetic account data cleanup failed for ${testUid}`);
  if (syntheticAuth?.idToken) {
    try { await deleteSyntheticMember(syntheticAuth.idToken); }
    catch (error) { cleanupError = cleanupError || error; }
  }
  if (cleanupError) throw cleanupError;
  console.log(`Synthetic Firebase data cleaned: ${runId}`);
}
