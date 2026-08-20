import { timingSafeEqual } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const OWNER_EMAIL = 'eewern21@gmail.com';
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

function getAdminAuth() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Firebase session service is not configured.');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('Firebase session service is misconfigured.');
  }

  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getAuth();
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
    const auth = getAdminAuth();
    const owner = await auth.getUserByEmail(OWNER_EMAIL);
    const token = await auth.createCustomToken(owner.uid);
    return send(res, 200, { token });
  } catch (error) {
    console.error('WAULT custom session failed:', error?.code || error?.message || error);
    return send(res, 503, { error: 'WAULT entry is temporarily unavailable. Try again shortly.' });
  }
}
