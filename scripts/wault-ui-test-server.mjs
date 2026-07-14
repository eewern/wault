import 'dotenv/config';
import { createSign } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DB = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
const configSource = readFileSync(resolve(ROOT, 'workspace-config.js'), 'utf8');
const webApiKey = process.env.FIREBASE_WEB_API_KEY || configSource.match(/firebaseApiKey:\s*["']([^"']+)/)?.[1] || '';
const databaseURL = configSource.match(/firebaseDatabaseURL:\s*["']([^"']+)/)?.[1] || DB;
const authDomain = configSource.match(/firebaseAuthDomain:\s*["']([^"']+)/)?.[1] || '';
const projectId = configSource.match(/firebaseProjectId:\s*["']([^"']+)/)?.[1] || '';
// An ephemeral port gives every run a fresh browser origin. Reusing a localhost
// origin lets an older tab inherit the new Firebase login and act on stale state.
const port = Number(process.env.WAULT_UI_TEST_PORT || 0);

if (!DB || !webApiKey || !databaseURL || !authDomain || !projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
  throw new Error('UI test server requires the Firebase database and service-account environment variables.');
}

const uid = `waultUiStress_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const email = `${uid}@wault.test`;
const bootstrapWorkspaceId = `__wault_ui_bootstrap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const bootstrapWorkspace = {
  pages: {
    home: { id: 'home', parentId: null, title: 'UI Reliability Test', blocks: [{ id: 'intro', type: 'text', text: '' }] },
  },
  rootOrder: ['home'],
  childOrder: {},
  currentPageId: 'home',
  settings: { workspaceName: 'UI Reliability Test' },
  events: {},
};
let serviceAccessToken = '';
let authSession = null;
let server = null;
let shuttingDown = false;

const allowedFiles = new Set([
  'index.html',
  'workspace-config.js',
  'workspace-localStorage-sync.js',
  'xalt-bible-data.js',
  'workspace-data.js',
  'workspace-persistence.js',
  'workspace-api-client.js',
  'firebase-sync.mjs',
  'workspace-blocks.jsx',
  'focus-home.jsx',
  'workspace-app.jsx',
  'reliability-core.js',
]);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
};

const base64Url = (value) => Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function signedJwt(audience, claims) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: audience,
    iat: now,
    exp: now + 3600,
    ...claims,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(serviceAccount.private_key);
  return `${header}.${payload}.${base64Url(signature)}`;
}

async function adminToken() {
  if (serviceAccessToken) return serviceAccessToken;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt('https://oauth2.googleapis.com/token', {
        scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
      }),
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(`Firebase admin OAuth failed (${response.status})`);
  serviceAccessToken = payload.access_token;
  return serviceAccessToken;
}

async function adminRequest(path, method = 'GET', body) {
  const response = await fetch(`${DB}/${String(path).replace(/^\/+/, '')}.json`, {
    method,
    headers: {
      authorization: `Bearer ${await adminToken()}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) throw new Error(`Firebase admin request failed (${response.status})`);
  return data;
}

function customToken() {
  return signedJwt('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', { uid });
}

async function createSyntheticSession() {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(webApiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken(), returnSecureToken: true }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.idToken) throw new Error(`Synthetic Firebase sign-in failed (${response.status})`);
  return payload;
}

async function deleteSyntheticSession() {
  if (!authSession?.idToken) return;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(webApiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: authSession.idToken }),
  });
  if (!response.ok) throw new Error(`Synthetic Firebase user cleanup failed (${response.status})`);
}

function loginPage() {
  const config = JSON.stringify({ apiKey: webApiKey, authDomain, projectId, databaseURL });
  const token = JSON.stringify(customToken());
  const workspaceId = JSON.stringify(bootstrapWorkspaceId);
  const workspaceData = JSON.stringify(bootstrapWorkspace);
  const workspaceList = JSON.stringify([{
    id: bootstrapWorkspaceId,
    name: 'UI Reliability Test',
    visibility: 'private',
    ownerUid: uid,
    ownerEmail: email,
  }]);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>WAULT UI reliability sign-in</title></head>
<body><p>Opening isolated WAULT reliability account...</p>
<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
const auth = getAuth(initializeApp(${config}));
await signInWithCustomToken(auth, ${token});
localStorage.clear();
sessionStorage.clear();
localStorage.setItem('workspace_v4_active_workspace', ${workspaceId});
localStorage.setItem('workspace_v4_workspaces', JSON.stringify(${workspaceList}));
localStorage.setItem('workspace_v4_data_' + ${workspaceId}, JSON.stringify(${workspaceData}));
location.replace('/index.html?ui_stress=1');
</script></body></html>`;
}

async function cleanup() {
  const catalog = await adminRequest('workspaceCatalog').catch(() => ({}));
  const ownedWorkspaceIds = Object.entries(catalog || {})
    .filter(([, row]) => row?.ownerUid === uid)
    .map(([workspaceId]) => workspaceId);
  const workspaceRoots = [
    'workspaces', 'workspaceCatalog', 'workspaceBackups', 'workspaceVersions',
    'workspaceDailyExports', 'workspaceDrafts', 'workspaceTrash', 'workspaceAuditLogs', 'presence',
  ];
  await Promise.all(ownedWorkspaceIds.flatMap((workspaceId) => (
    workspaceRoots.map((root) => adminRequest(`${root}/${workspaceId}`, 'DELETE').catch(() => null))
  )));
  await Promise.all([
    adminRequest(`access/${uid}`, 'DELETE').catch(() => null),
    adminRequest(`focus/${uid}`, 'DELETE').catch(() => null),
    adminRequest(`users/${uid}`, 'DELETE').catch(() => null),
    adminRequest(`signins/${uid}`, 'DELETE').catch(() => null),
    adminRequest(`apiKeys/${uid}`, 'DELETE').catch(() => null),
    adminRequest(`workspaceAuditLogs/focus_${uid}`, 'DELETE').catch(() => null),
  ]);
  await deleteSyntheticSession().catch(() => null);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  await cleanup();
  console.log(`WAULT UI stress account cleaned: ${uid}`);
  process.exit(exitCode);
}

authSession = await createSyntheticSession();
await adminRequest(`access/${uid}`, 'PUT', {
  email,
  role: 'member',
  approvedAt: new Date().toISOString(),
});
const bootstrapTime = new Date().toISOString();
await adminRequest(`workspaceCatalog/${bootstrapWorkspaceId}`, 'PUT', {
  id: bootstrapWorkspaceId,
  name: 'UI Reliability Test',
  visibility: 'private',
  ownerUid: uid,
  ownerEmail: email,
  updatedAt: bootstrapTime,
  createdAt: bootstrapTime,
  deleted: false,
});
await adminRequest(`workspaces/${bootstrapWorkspaceId}`, 'PUT', {
  workspace: bootstrapWorkspace,
  updated_at: bootstrapTime,
  source: 'ui-reliability-bootstrap',
  saveId: 'ui-reliability-bootstrap',
  revision: 1,
});

server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://127.0.0.1:${port}`).pathname);
  if (pathname === '/__wault_test_signin') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(loginPage());
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!allowedFiles.has(relative)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  readFile(resolve(ROOT, relative), (error, bytes) => {
    if (error) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': mime[extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(bytes);
  });
});

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  console.log(`WAULT UI test ready: http://127.0.0.1:${actualPort}/__wault_test_signin`);
  console.log(`Synthetic member: ${uid}`);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', (error) => {
  console.error(error);
  shutdown(1);
});
process.on('unhandledRejection', (error) => {
  console.error(error);
  shutdown(1);
});
