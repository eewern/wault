# Workspace REST API

This API lets other platforms read and write the same workspace JSON shape used by the browser app.

## Run

```bash
cd "/Users/eewern/Downloads/Notion design"
node workspace-api-server.mjs
```

Default API URL:

```text
http://127.0.0.1:3334
```

Optional environment variables:

```bash
WORKSPACE_API_PORT=3334
WORKSPACE_API_HOST=127.0.0.1
WORKSPACE_API_STORE="/Users/eewern/Downloads/Notion design/workspace-api-store.json"
WORKSPACE_API_TOKEN="change-me"
node workspace-api-server.mjs
```

If `WORKSPACE_API_TOKEN` is set, send either:

```text
Authorization: Bearer change-me
```

or:

```text
x-workspace-api-token: change-me
```

## Connect the Browser App

Start the normal static site:

```bash
python3 -m http.server 3333
```

Open the app with the API bridge enabled:

```text
http://127.0.0.1:3333/?api=http://127.0.0.1:3334
```

With a token:

```text
http://127.0.0.1:3333/?api=http://127.0.0.1:3334&apiToken=change-me
```

The bridge mirrors `workspace_v4_data_*` localStorage workspaces into the REST API whenever the app saves.

## Endpoints

```text
GET    /health
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:workspaceId
PUT    /api/workspaces/:workspaceId
PATCH  /api/workspaces/:workspaceId
DELETE /api/workspaces/:workspaceId
POST   /api/workspaces/:workspaceId/import

GET    /api/workspaces/:workspaceId/pages
POST   /api/workspaces/:workspaceId/pages
GET    /api/workspaces/:workspaceId/pages/:pageId
PATCH  /api/workspaces/:workspaceId/pages/:pageId
DELETE /api/workspaces/:workspaceId/pages/:pageId

GET    /api/workspaces/:workspaceId/pages/:pageId/blocks
POST   /api/workspaces/:workspaceId/pages/:pageId/blocks
GET    /api/workspaces/:workspaceId/pages/:pageId/blocks/:blockId
PATCH  /api/workspaces/:workspaceId/pages/:pageId/blocks/:blockId
DELETE /api/workspaces/:workspaceId/pages/:pageId/blocks/:blockId
```

## Examples

Create or replace a workspace:

```bash
curl -X PUT http://127.0.0.1:3334/api/workspaces/churns_ai_bible \
  -H 'content-type: application/json' \
  -d '{"name":"Churns AI Bible","data":{"pages":{},"rootOrder":[],"childOrder":{},"currentPageId":null}}'
```

List workspaces:

```bash
curl http://127.0.0.1:3334/api/workspaces
```

Add a page:

```bash
curl -X POST http://127.0.0.1:3334/api/workspaces/churns_ai_bible/pages \
  -H 'content-type: application/json' \
  -d '{"title":"External Notes","blocks":[{"id":"b_ext_1","type":"text","text":"Created through API"}]}'
```

Patch a block:

```bash
curl -X PATCH http://127.0.0.1:3334/api/workspaces/churns_ai_bible/pages/p_ext/blocks/b_ext_1 \
  -H 'content-type: application/json' \
  -d '{"text":"Updated from another platform"}'
```
