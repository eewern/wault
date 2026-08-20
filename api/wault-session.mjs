import { createSign, timingSafeEqual } from 'node:crypto';
const attempts = new Map();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

function send(res, status, body) {
  res.status(status)
    .setHeader('Cache-Control', 'no-store, max-age=0')
    .setHeader('Content-Type', 'application/json; charset=utf-8')
    .json(body);
}

function matchesPasscode(value, expected) {
  const supplied = Buffer.from(String(value || ''));
  const configured = Buffer.from(String(expected || ''));
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

function isRateLimited(ip) {
  const now = Date.now();
  const existing = attempts.get(ip);
  if (!existing || now - existing.startedAt > WINDOW_MS) {
    attempts.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  existing.count += 1;
  return existing.count > MAX_ATTEMPTS;
}

function createFirebaseCustomToken() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Firebase session service is not configured.');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('Firebase session service is misconfigured.');
  }

  const ownerUid = String(process.env.WAULT_OWNER_UID || '').trim();
  if (!serviceAccount.client_email || !serviceAccount.private_key || !ownerUid) {
    throw new Error('Firebase session service is misconfigured.');
  }

  const base64Url = (value) => Buffer.from(value).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: ownerUid,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key);
  return `${unsigned}.${base64Url(signature)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  const expectedPasscode = process.env.WAULT_ENTRY_PASSCODE;
  if (!expectedPasscode) return send(res, 503, { error: 'WAULT entry is not configured yet.' });

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return send(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });

  const passcode = req.body && typeof req.body === 'object' ? req.body.passcode : '';
  if (!matchesPasscode(passcode, expectedPasscode)) return send(res, 401, { error: 'That passcode is not correct.' });

  try {
    const token = createFirebaseCustomToken();
    return send(res, 200, { token });
  } catch (error) {
    console.error('WAULT custom session failed:', error?.code || error?.message || error);
    return send(res, 503, { error: 'WAULT entry is temporarily unavailable. Try again shortly.' });
  }
}
