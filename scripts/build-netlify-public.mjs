import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, ".netlify-publish");

// Explicit browser-safe allowlist. Server code, local data stores, credentials,
// documentation, uploads, dependencies, and dotfiles can never enter the deploy.
const publicFiles = [
  "index.html",
  "workspace-config.js",
  "workspace-localStorage-sync.js",
  "xalt-bible-data.js",
  "workspace-data.js",
  "workspace-persistence.js",
  "workspace-api-client.js",
  "reliability-core.js",
  "firebase-sync.mjs",
  "workspace-blocks.jsx",
  "focus-home.jsx",
  "workspace-app.jsx",
];

const forbidden = [
  "BEGIN PRIVATE KEY",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "WORKSPACE_API_TOKEN",
  '"private_key"',
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const relative of publicFiles) {
  const source = resolve(root, relative);
  const target = resolve(out, relative);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  const text = await readFile(target, "utf8");
  for (const marker of forbidden) {
    if (text.includes(marker)) throw new Error(`Sensitive marker ${marker} found in public file ${relative}`);
  }
}

console.log(`Built secure Netlify artifact with ${publicFiles.length} allowlisted files.`);
