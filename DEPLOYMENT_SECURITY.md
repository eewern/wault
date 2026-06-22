# WAULT deployment security boundary

Netlify is built into `.netlify-publish/` by `npm run build:netlify`. The build
script uses an explicit allowlist; never deploy the repository root.

## Public browser files

- `index.html`
- `workspace-config.js` (Firebase web configuration and public API URL only)
- `workspace-api-client.js`
- `firebase-sync.mjs`
- `workspace-app.jsx`, `workspace-blocks.jsx`, `focus-home.jsx`
- `workspace-data.js`, `xalt-bible-data.js`
- `workspace-localStorage-sync.js`, `workspace-persistence.js`

Firebase web API keys are public application identifiers. Access is enforced by
Google sign-in and `database.rules.json`, not by hiding the web configuration.

## Server-only or private files

- `.env` and all environment variants
- Firebase service-account JSON/private keys
- `WORKSPACE_API_TOKEN`, `WAULT_API_TOKEN`, and `MCP_TOKEN`
- `workspace-api-store.json` and backup/export files
- Railway/API/MCP server source and configuration
- `node_modules/`, `.netlify/`, `.claude/`, docs, migrations, and `uploads/`

The browser receives a signed-in user's revocable Firebase-backed API key only
in memory after access approval. It is cleared on sign-out and is never embedded
in source, localStorage, URLs, Git, or the Netlify artifact.

## Release checks

1. Run `npm run build:netlify`.
2. Confirm the build reports only the allowlisted files.
3. Scan `.netlify-publish/` for credentials and private-key markers.
4. Deploy `.netlify-publish/` through the linked Netlify site.
5. Verify private paths return 404 and the Railway API rejects unauthenticated requests.
