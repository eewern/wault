#!/usr/bin/env node
/**
 * Deploy database.rules.json to Firebase Realtime Database.
 *
 * Setup:
 * 1. Firebase Console -> Project Settings -> Service Accounts
 * 2. Generate a private key JSON file
 * 3. Save it outside git, or as ./firebase-service-account.json locally
 * 4. Run: node firebase-rules-deployer.mjs
 *
 * Optional env:
 * - FIREBASE_DATABASE_URL=https://wernotion-default-rtdb.asia-southeast1.firebasedatabase.app
 * - FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account.json
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIREBASE_DATABASE_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  "https://wernotion-default-rtdb.asia-southeast1.firebasedatabase.app"
).replace(/\/$/, "");
const SERVICE_ACCOUNT_PATH = resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  `${__dirname}/firebase-service-account.json`
);
const RULES_PATH = resolve(__dirname, "database.rules.json");

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createServiceAccountJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/cloud-platform",
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.private_key);
  return `${unsigned}.${base64url(signature)}`;
}

async function getAccessToken(serviceAccount) {
  const assertion = createServiceAccountJwt(serviceAccount);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Failed to get Google access token: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

async function deployRules() {
  console.log("Firebase Realtime Database rules deploy");
  console.log(`Database: ${FIREBASE_DATABASE_URL}`);
  console.log(`Rules:    ${RULES_PATH}`);

  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  const rules = JSON.parse(readFileSync(RULES_PATH, "utf8"));
  const accessToken = await getAccessToken(serviceAccount);

  const res = await fetch(`${FIREBASE_DATABASE_URL}/.settings/rules.json`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(rules, null, 2),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to deploy rules: ${res.status} ${text}`);
  }

  console.log("Rules deployed successfully.");
}

deployRules().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
