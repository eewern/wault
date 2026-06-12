# wernotion company MCP setup

## Access model

Use one hosted wernotion API server for the company.

Each teammate uses their own access:

1. Teammate signs in to wernotion with Google.
2. Owner approves the teammate in the Team modal.
3. Teammate opens the Claude modal and generates their own API key.
4. Claude Code sends that key to the hosted API server.
5. The API server validates both records in Firebase:
   - `apiKeys/{uid}` contains the submitted key.
   - `access/{uid}` still exists.

If `access/{uid}` is removed, the key stops working even if the old API-key record still exists.

## Firebase paths

Approved users:

```text
access/{uid}
```

Personal API keys:

```text
apiKeys/{uid}
```

The browser can only read, create, and delete its own API-key record. It cannot read or modify other users' keys.

## Hosted API server environment

Run the API server with Firebase validation enabled:

```bash
FIREBASE_DATABASE_URL="https://wernotion-default-rtdb.asia-southeast1.firebasedatabase.app" \
FIREBASE_SERVICE_ACCOUNT_PATH="/secure/path/wernotion-firebase-adminsdk.json" \
WORKSPACE_API_STORE="/secure/path/workspace-api-store.json" \
WORKSPACE_API_ORIGIN="https://wernotion.netlify.app" \
node workspace-api-server.mjs
```

Health check:

```bash
curl https://wernotion.netlify.app/health
```

The response should show:

```json
{
  "ok": true,
  "firebaseDatabaseConfigured": true,
  "firebaseServiceAccountConfigured": true
}
```

## Teammate Claude Code setup

Each teammate installs Claude Code, then runs:

```bash
claude mcp add wernotion \
  -e WERNOTION_API_URL=https://wernotion.netlify.app \
  -e WERNOTION_API_TOKEN=wn_their_generated_key \
  -- node "/path/to/wernotion-mcp.mjs"
```

Then test in Claude Code:

```text
List my wernotion workspaces.
```

## Revocation

To remove a teammate's MCP access:

1. Remove the teammate in the wernotion Team modal.
2. Their API key stops authorizing against the hosted API server because `access/{uid}` no longer exists.
3. The server cache lasts up to 30 seconds.

If the teammate still has browser access open, ask them to sign out or refresh. Firebase rules will block workspace reads and writes once access is removed.
