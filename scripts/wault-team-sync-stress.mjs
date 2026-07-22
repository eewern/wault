import 'dotenv/config';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DB = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
const configSource = readFileSync(new URL('../workspace-config.js', import.meta.url), 'utf8');
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || configSource.match(/firebaseApiKey:\s*["']([^"']+)/)?.[1] || '';

if (!DB || !WEB_API_KEY || !serviceAccount.client_email || !serviceAccount.private_key) {
  throw new Error('Team sync stress requires FIREBASE_DATABASE_URL and FIREBASE_SERVICE_ACCOUNT_JSON.');
}

const base64Url = (value) => Buffer.from(value).toString('base64url');
function signedJwt(claims) {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(claims));
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(serviceAccount.private_key);
  return `${header}.${body}.${base64Url(signature)}`;
}

let serviceAccessToken = '';
async function serviceToken() {
  if (serviceAccessToken) return serviceAccessToken;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signedJwt({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`OAuth failed (${response.status})`);
  serviceAccessToken = payload.access_token;
  return serviceAccessToken;
}

function firebaseCustomToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  return signedJwt({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  });
}

async function signInSyntheticUser(uid) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: firebaseCustomToken(uid), returnSecureToken: true }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.idToken) throw new Error(`Synthetic sign-in failed (${response.status})`);
  return payload;
}

async function deleteSyntheticUser(idToken) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw new Error(`Synthetic user cleanup failed (${response.status})`);
}

async function request(path, { method = 'GET', body, idToken = '', etag = false, ifMatch = '' } = {}) {
  const query = idToken ? `?auth=${encodeURIComponent(idToken)}` : '';
  const headers = idToken ? {} : { authorization: `Bearer ${await serviceToken()}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (etag) headers['X-Firebase-ETag'] = 'true';
  if (ifMatch) headers['If-Match'] = ifMatch;
  const response = await fetch(`${DB}/${String(path).replace(/^\/+/, '')}.json${query}`, {
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

async function requireOk(promise, label) {
  const result = await promise;
  if (!result.ok) throw new Error(`${label} failed (${result.status})`);
  return result;
}

function openFirebaseStream(path, idToken) {
  const controller = new AbortController();
  const events = [];
  const waiters = new Set();
  let streamError = null;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const notify = (event) => {
    events.push(event);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(event)) continue;
      clearTimeout(waiter.timeout);
      waiters.delete(waiter);
      waiter.resolve(event);
    }
  };

  const started = (async () => {
    try {
      const response = await fetch(`${DB}/${String(path).replace(/^\/+/, '')}.json?auth=${encodeURIComponent(idToken)}`, {
        headers: { accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Realtime stream failed (${response.status})`);
      resolveReady();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const eventLine = block.split('\n').find((line) => line.startsWith('event:'));
          const dataLine = block.split('\n').find((line) => line.startsWith('data:'));
          if (eventLine && dataLine) {
            let payload = null;
            try { payload = JSON.parse(dataLine.slice(5).trim()); } catch {}
            notify({ type: eventLine.slice(6).trim(), payload });
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        streamError = error;
        rejectReady(error);
        for (const waiter of [...waiters]) {
          clearTimeout(waiter.timeout);
          waiters.delete(waiter);
          waiter.reject(error);
        }
      }
    }
  })().catch(() => {});

  return {
    async waitFor(predicate, timeoutMs = 12000) {
      const existing = events.find(predicate);
      if (existing) return existing;
      if (streamError) throw streamError;
      await ready;
      const eventAfterStartup = events.find(predicate);
      if (eventAfterStartup) return eventAfterStartup;
      if (streamError) throw streamError;
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          reject,
          timeout: setTimeout(() => {
            waiters.delete(waiter);
            reject(new Error(`Realtime event timeout for ${path}`));
          }, timeoutMs),
        };
        waiters.add(waiter);
      });
    },
    close() {
      controller.abort();
    },
  };
}

let assertions = 0;
function check(condition, label) {
  if (!condition) throw new Error(label);
  assertions += 1;
}

const runId = `__wault_team_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const uidA = `waultTeamA_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const uidB = `waultTeamB_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const paths = {
  workspace: `workspaces/${runId}`,
  catalog: `workspaceCatalog/${runId}`,
  focusA: `focus/${uidA}`,
  accessA: `access/${uidA}`,
  accessB: `access/${uidB}`,
};
let userA = null;
let userB = null;
let workspaceStream = null;
let focusStream = null;

const now = () => new Date().toISOString();
const workspaceRecord = (marker, revision) => ({
  workspace: {
    pages: {
      page: {
        id: 'page',
        parentId: null,
        title: 'Team Sync Stress',
        blocks: [{ id: 'marker', type: 'text', text: marker }],
      },
    },
    rootOrder: ['page'],
    childOrder: {},
    currentPageId: 'page',
    settings: { workspaceName: 'Team Sync Stress' },
    events: {},
  },
  updated_at: now(),
  source: 'team-sync-stress',
  saveId: runId,
  revision,
});

try {
  console.log(`Starting two-identity realtime sync stress: ${runId}`);
  [userA, userB] = await Promise.all([signInSyntheticUser(uidA), signInSyntheticUser(uidB)]);
  await Promise.all([
    requireOk(request(paths.accessA, { method: 'PUT', body: { email: `${uidA}@wault.test`, role: 'member', addedAt: now() } }), 'member A access grant'),
    requireOk(request(paths.accessB, { method: 'PUT', body: { email: `${uidB}@wault.test`, role: 'member', addedAt: now() } }), 'member B access grant'),
    requireOk(request(paths.catalog, {
      method: 'PUT',
      body: { id: runId, name: 'Team Sync Stress', visibility: 'shared', ownerUid: uidA, ownerEmail: `${uidA}@wault.test`, updatedAt: now(), deleted: false },
    }), 'shared workspace catalog create'),
  ]);

  const memberDirectoryRead = await request('access', { idToken: userA.idToken });
  check(!memberDirectoryRead.ok, 'member could read the owner-only team directory');
  const selfPromotion = await request(paths.accessA, {
    method: 'PUT',
    idToken: userA.idToken,
    body: { email: `${uidA}@wault.test`, role: 'owner', addedAt: now() },
  });
  check(!selfPromotion.ok, 'member could promote itself to owner');

  const first = workspaceRecord('member-a-created', 1);
  await requireOk(request(paths.workspace, { method: 'PUT', body: first, idToken: userA.idToken }), 'member A workspace create');
  const memberBInitial = await requireOk(request(paths.workspace, { idToken: userB.idToken }), 'member B initial workspace read');
  check(memberBInitial.data?.workspace?.pages?.page?.blocks?.[0]?.text === 'member-a-created', 'member B did not read member A content');

  workspaceStream = openFirebaseStream(paths.workspace, userB.idToken);
  await workspaceStream.waitFor((event) => event.type === 'put');
  const realtimeMarker = `realtime-${Date.now()}`;
  await requireOk(request(paths.workspace, {
    method: 'PUT',
    idToken: userA.idToken,
    body: workspaceRecord(realtimeMarker, 2),
  }), 'member A realtime update');
  await workspaceStream.waitFor((event) => JSON.stringify(event.payload || {}).includes(realtimeMarker));
  check(true, 'member B realtime listener did not receive member A update');

  let currentRevision = 2;
  for (let index = 0; index < 25; index += 1) {
    currentRevision += 1;
    const marker = `rapid-${index}`;
    const writer = index % 2 === 0 ? userA.idToken : userB.idToken;
    const reader = index % 2 === 0 ? userB.idToken : userA.idToken;
    await requireOk(request(paths.workspace, {
      method: 'PUT',
      idToken: writer,
      body: workspaceRecord(marker, currentRevision),
    }), `rapid teammate write ${index}`);
    const readback = await requireOk(request(paths.workspace, { idToken: reader }), `rapid teammate read ${index}`);
    check(readback.data?.workspace?.pages?.page?.blocks?.[0]?.text === marker, `rapid teammate read mismatch ${index}`);
  }

  const conflictBase = await requireOk(request(paths.workspace, { idToken: userA.idToken, etag: true }), 'cross-account conflict base');
  const nextRevision = Number(conflictBase.data?.revision || currentRevision) + 1;
  const concurrent = await Promise.all([
    request(paths.workspace, { method: 'PUT', idToken: userA.idToken, ifMatch: conflictBase.etag, body: workspaceRecord('concurrent-a', nextRevision) }),
    request(paths.workspace, { method: 'PUT', idToken: userB.idToken, ifMatch: conflictBase.etag, body: workspaceRecord('concurrent-b', nextRevision) }),
  ]);
  check(concurrent.filter((result) => result.ok).length === 1, 'cross-account concurrent save had the wrong winner count');
  check(concurrent.filter((result) => result.status === 412).length === 1, 'cross-account stale save was not rejected');

  const finalRecord = await requireOk(request(paths.workspace, { idToken: userA.idToken }), 'final owner-side read');
  for (let reload = 0; reload < 3; reload += 1) {
    const [readA, readB] = await Promise.all([
      requireOk(request(paths.workspace, { idToken: userA.idToken }), `member A reload ${reload}`),
      requireOk(request(paths.workspace, { idToken: userB.idToken }), `member B reload ${reload}`),
    ]);
    check(JSON.stringify(readA.data) === JSON.stringify(finalRecord.data), `member A reload diverged ${reload}`);
    check(JSON.stringify(readB.data) === JSON.stringify(finalRecord.data), `member B reload diverged ${reload}`);
  }

  focusStream = openFirebaseStream(`${paths.focusA}/tasks`, userA.idToken);
  await focusStream.waitFor((event) => event.type === 'put');
  const focusTask = {
    id: 'focus_task',
    title: 'Same-account realtime focus task',
    status: 'todo',
    priority: 'high',
    createdAt: now(),
    updatedAt: now(),
  };
  await requireOk(request(`${paths.focusA}/tasks/${focusTask.id}`, {
    method: 'PUT',
    idToken: userA.idToken,
    body: focusTask,
  }), 'Focus task create');
  await focusStream.waitFor((event) => JSON.stringify(event.payload || {}).includes(focusTask.title));
  check(true, 'same-account Focus listener missed task create');
  const focusReload = await requireOk(request(`${paths.focusA}/tasks/${focusTask.id}`, { idToken: userA.idToken }), 'Focus task reload');
  check(focusReload.data?.title === focusTask.title, 'same-account Focus reload lost task');
  const teammateFocusRead = await request(`${paths.focusA}/tasks`, { idToken: userB.idToken });
  check(!teammateFocusRead.ok, 'another teammate could read the per-user Focus list');

  await requireOk(request(`${paths.focusA}/tasks/${focusTask.id}`, {
    method: 'DELETE',
    idToken: userA.idToken,
  }), 'Focus task delete');
  await focusStream.waitFor((event) => (
    event.payload?.data === null
    && String(event.payload?.path || '').includes(focusTask.id)
  ));
  for (let reload = 0; reload < 3; reload += 1) {
    const deleted = await requireOk(request(`${paths.focusA}/tasks/${focusTask.id}`, { idToken: userA.idToken }), `Focus delete reload ${reload}`);
    check(deleted.data === null, `Focus task resurrected after reload ${reload}`);
  }

  console.log(`Two-identity realtime sync stress passed: ${assertions} assertions`);
} finally {
  workspaceStream?.close();
  focusStream?.close();
  await Promise.all([
    request(paths.workspace, { method: 'DELETE' }).catch(() => null),
    request(paths.catalog, { method: 'DELETE' }).catch(() => null),
    request(paths.focusA, { method: 'DELETE' }).catch(() => null),
    request(paths.accessA, { method: 'DELETE' }).catch(() => null),
    request(paths.accessB, { method: 'DELETE' }).catch(() => null),
  ]);
  const cleanup = await Promise.all([
    request(paths.workspace),
    request(paths.catalog),
    request(paths.focusA),
    request(paths.accessA),
    request(paths.accessB),
  ]);
  if (cleanup.some((result) => result.data !== null)) throw new Error(`Synthetic cleanup failed for ${runId}`);
  await Promise.all([
    userA?.idToken ? deleteSyntheticUser(userA.idToken).catch(() => null) : null,
    userB?.idToken ? deleteSyntheticUser(userB.idToken).catch(() => null) : null,
  ]);
  console.log(`Synthetic team-sync data cleaned: ${runId}`);
}
