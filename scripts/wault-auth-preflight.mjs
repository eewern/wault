import 'dotenv/config';
import { createSign } from 'node:crypto';

const projectId = 'wernotion';
const requiredDomain = 'waults.vercel.app';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');

if (!serviceAccount.client_email || !serviceAccount.private_key) {
  throw new Error('Auth preflight requires FIREBASE_SERVICE_ACCOUNT_JSON.');
}

const encode = (value) => Buffer.from(value).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const claims = encode(JSON.stringify({
  iss: serviceAccount.client_email,
  sub: serviceAccount.client_email,
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
  scope: 'https://www.googleapis.com/auth/identitytoolkit',
}));
const signature = createSign('RSA-SHA256')
  .update(`${header}.${claims}`)
  .sign(serviceAccount.private_key)
  .toString('base64url');

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${header}.${claims}.${signature}`,
  }),
});
const token = await tokenResponse.json();
if (!tokenResponse.ok || !token.access_token) {
  throw new Error(`Could not authenticate Firebase auth preflight (${tokenResponse.status}).`);
}

const configResponse = await fetch(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`, {
  headers: { authorization: `Bearer ${token.access_token}` },
});
const config = await configResponse.json();
if (!configResponse.ok) {
  throw new Error(`Could not load Firebase auth configuration (${configResponse.status}).`);
}

const authorizedDomains = Array.isArray(config.authorizedDomains) ? config.authorizedDomains : [];
if (!authorizedDomains.includes(requiredDomain)) {
  throw new Error(`Firebase Auth does not authorize ${requiredDomain}.`);
}

console.log(`Firebase auth preflight passed: ${requiredDomain} is authorized for ${projectId}.`);
