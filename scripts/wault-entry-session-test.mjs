import { readFileSync } from 'node:fs';
import handler from '../api/wault-session.mjs';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

async function invoke({ method = 'POST', body = {}, headers = {} } = {}) {
  const res = responseRecorder();
  await handler({ method, body, headers, socket: { remoteAddress: '127.0.0.1' } }, res);
  return res;
}

process.env.WAULT_ENTRY_PASSCODE = 'WERN';
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let result = await invoke({ method: 'GET' });
check(result.statusCode === 405, 'session endpoint accepts an unexpected HTTP method');

result = await invoke({ body: { passcode: 'wrong' } });
check(result.statusCode === 401, 'session endpoint accepts an incorrect passcode');
check(!result.payload?.token, 'session endpoint leaks a token after an incorrect passcode');

result = await invoke({ body: { passcode: 'WERN' } });
check(result.statusCode === 503, 'session endpoint continues without its server-side Firebase credential');
check(!result.payload?.token, 'session endpoint leaks a token when misconfigured');
check(result.headers['cache-control'] === 'no-store, max-age=0', 'session responses can be cached by a browser or proxy');

const firebaseSyncSource = readFileSync(new URL('../firebase-sync.mjs', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../workspace-app.jsx', import.meta.url), 'utf8');
const endpointSource = readFileSync(new URL('../api/wault-session.mjs', import.meta.url), 'utf8');
check(firebaseSyncSource.includes('signInWithCustomToken(auth, payload.token)'), 'the app does not exchange the passcode session for Firebase authentication');
check(!firebaseSyncSource.includes('async signInWithGoogle()'), 'normal WAULT entry still exposes Google sign-in');
check(appSource.includes('function PasscodeScreen'), 'the UI does not render a passcode entry screen');
check(!appSource.includes('<GoogleSignInScreen'), 'the UI still renders Google sign-in');
check(endpointSource.includes('timingSafeEqual'), 'the passcode comparison is not timing-safe');
check(endpointSource.includes('FIREBASE_SERVICE_ACCOUNT_JSON'), 'the Firebase Admin credential is not server-side');
console.log('WAULT passcode-session tests passed.');
