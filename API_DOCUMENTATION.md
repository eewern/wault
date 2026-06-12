# Workspace REST API - Complete Documentation

## Overview

The Workspace API is a REST-based interface that allows external applications to programmatically read and write workspace data. It's designed to work alongside the browser-based editor, supporting full CRUD operations on workspaces, pages, and blocks.

**Status**: Production-ready | **Version**: 1.0 | **Data Format**: JSON

---

## Setup & Configuration

### Start the API Server

```bash
cd "/Users/eewern/Desktop/Notion design"
node workspace-api-server.mjs
```

**Default URL**: `http://127.0.0.1:3334`

### Environment Variables

```bash
# Port (default: 3334)
WORKSPACE_API_PORT=3334

# Host (default: 127.0.0.1)
WORKSPACE_API_HOST=127.0.0.1

# Data store file path (default: ./workspace-api-store.json)
WORKSPACE_API_STORE="/Users/eewern/Desktop/Notion design/workspace-api-store.json"

# Optional authentication token
WORKSPACE_API_TOKEN="your-secret-token"

# CORS origin (default: * for all origins)
WORKSPACE_API_ORIGIN="http://localhost:3000"
```

### Run with Custom Configuration

```bash
WORKSPACE_API_PORT=3334 \
WORKSPACE_API_TOKEN="my-secret-token" \
node workspace-api-server.mjs
```

---

## Authentication

### Optional Token-Based Auth

If `WORKSPACE_API_TOKEN` is set, all requests must include one of:

**Authorization Header**:
```bash
Authorization: Bearer your-secret-token
```

**Custom Header**:
```bash
x-workspace-api-token: your-secret-token
```

### No Auth Required (Development)

If `WORKSPACE_API_TOKEN` is not set, requests work without authentication.

---

## Core Endpoints

### 1. Health Check

```
GET /health
```

**Response** (200):
```json
{ "status": "ok" }
```

---

## Workspace Endpoints

### List All Workspaces

```
GET /api/workspaces
```

**Response** (200):
```json
{
  "workspaces": [
    {
      "id": "churns_ai_bible",
      "name": "Churns AI Bible",
      "source": "api",
      "pageCount": 32,
      "currentPageId": "p_home",
      "createdAt": "2026-05-22T11:23:45Z",
      "updatedAt": "2026-05-24T16:30:12Z"
    }
  ]
}
```

---

### Create Workspace

```
POST /api/workspaces
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "My New Workspace",
  "source": "api"
}
```

**Response** (201):
```json
{
  "workspace": {
    "id": "ws_generated_id",
    "name": "My New Workspace",
    "source": "api",
    "data": {
      "pages": {},
      "rootOrder": [],
      "childOrder": {},
      "currentPageId": null
    },
    "createdAt": "2026-05-24T17:00:00Z",
    "updatedAt": "2026-05-24T17:00:00Z"
  }
}
```

---

### Get Workspace by ID

```
GET /api/workspaces/{workspaceId}
```

**Example**:
```bash
curl http://127.0.0.1:3334/api/workspaces/churns_ai_bible
```

**Response** (200):
```json
{
  "workspace": {
    "id": "churns_ai_bible",
    "name": "Churns AI Bible",
    "source": "api",
    "data": {
      "pages": {
        "p_home": {
          "id": "p_home",
          "parentId": null,
          "title": "Home",
          "icon": "🏠",
          "blocks": [...]
        }
      },
      "rootOrder": ["p_home", "p_about"],
      "childOrder": {},
      "currentPageId": "p_home"
    },
    "createdAt": "2026-05-22T11:23:45Z",
    "updatedAt": "2026-05-24T16:30:12Z"
  }
}
```

---

### Update/Replace Workspace (PUT)

```
PUT /api/workspaces/{workspaceId}
Content-Type: application/json
```

**Request Body** (replaces entire workspace):
```json
{
  "name": "Updated Name",
  "data": {
    "pages": {},
    "rootOrder": [],
    "childOrder": {},
    "currentPageId": null
  }
}
```

**Response** (200): Returns updated workspace

---

### Partial Update Workspace (PATCH)

```
PATCH /api/workspaces/{workspaceId}
Content-Type: application/json
```

**Request Body** (updates only provided fields):
```json
{
  "name": "New Name Only"
}
```

**Response** (200): Returns updated workspace

---

### Delete Workspace

```
DELETE /api/workspaces/{workspaceId}
```

**Response** (204 No Content)

---

### Import Workspace Data

```
POST /api/workspaces/{workspaceId}/import
Content-Type: application/json
```

**Use Case**: Bulk-import workspace data structure

**Request Body**:
```json
{
  "name": "Imported Workspace",
  "data": {
    "pages": { ... },
    "rootOrder": [...],
    "childOrder": {},
    "currentPageId": null
  }
}
```

**Response** (200): Returns updated workspace

---

## Page Endpoints

### List All Pages in Workspace

```
GET /api/workspaces/{workspaceId}/pages
```

**Response** (200):
```json
{
  "pages": [
    {
      "id": "p_home",
      "parentId": null,
      "title": "Home",
      "icon": "🏠",
      "blocks": [...]
    }
  ]
}
```

---

### Create Page

```
POST /api/workspaces/{workspaceId}/pages
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "New Page",
  "parentId": null,
  "icon": "📄",
  "blocks": [
    {
      "id": "b_1",
      "type": "text",
      "text": "Welcome to this page"
    }
  ]
}
```

**Response** (201):
```json
{
  "page": {
    "id": "p_xyz",
    "parentId": null,
    "title": "New Page",
    "icon": "📄",
    "blocks": [...]
  },
  "workspace": { ... }
}
```

---

### Get Page by ID

```
GET /api/workspaces/{workspaceId}/pages/{pageId}
```

**Response** (200): Returns full page object with all blocks

---

### Update Page (PATCH)

```
PATCH /api/workspaces/{workspaceId}/pages/{pageId}
Content-Type: application/json
```

**Request Body** (update title, icon, or blocks):
```json
{
  "title": "Updated Title",
  "icon": "⭐"
}
```

**Response** (200): Returns updated page

---

### Delete Page

```
DELETE /api/workspaces/{workspaceId}/pages/{pageId}
```

**Response** (204 No Content)

---

## Block Endpoints

### List All Blocks in Page

```
GET /api/workspaces/{workspaceId}/pages/{pageId}/blocks
```

**Response** (200):
```json
{
  "blocks": [
    {
      "id": "b_1",
      "type": "text",
      "text": "Hello world"
    },
    {
      "id": "b_2",
      "type": "heading",
      "level": 1,
      "text": "Title"
    }
  ]
}
```

---

### Create Block

```
POST /api/workspaces/{workspaceId}/pages/{pageId}/blocks
Content-Type: application/json
```

**Request Body**:
```json
{
  "type": "text",
  "text": "New block content",
  "afterBlockId": "b_1"
}
```

**Parameters**:
- `afterBlockId` (optional): Insert after this block. If omitted, appends to end.

**Response** (201): Returns created block

---

### Get Block by ID

```
GET /api/workspaces/{workspaceId}/pages/{pageId}/blocks/{blockId}
```

**Response** (200): Returns single block

---

### Update Block (PATCH)

```
PATCH /api/workspaces/{workspaceId}/pages/{pageId}/blocks/{blockId}
Content-Type: application/json
```

**Request Body** (update any block properties):
```json
{
  "text": "Updated content"
}
```

**Response** (200): Returns updated block

---

### Delete Block

```
DELETE /api/workspaces/{workspaceId}/pages/{pageId}/blocks/{blockId}
```

**Response** (204 No Content)

---

## Block Types Reference

### Text Block
```json
{
  "id": "b_1",
  "type": "text",
  "text": "<p>Paragraph content</p>"
}
```

### Heading Block
```json
{
  "id": "b_2",
  "type": "heading",
  "level": 1,
  "text": "<h1>Heading text</h1>"
}
```

### Numbered List Block
```json
{
  "id": "b_3",
  "type": "numbers",
  "items": [
    { "id": "i_1", "text": "First item", "level": 0 },
    { "id": "i_2", "text": "Second item (nested)", "level": 1 },
    { "id": "i_3", "text": "Third item", "level": 0 }
  ]
}
```

### Bulleted List Block
```json
{
  "id": "b_4",
  "type": "bullets",
  "items": [
    { "id": "i_1", "text": "Bullet point", "level": 0 }
  ]
}
```

### Checklist Block
```json
{
  "id": "b_5",
  "type": "checklist",
  "items": [
    { "id": "i_1", "text": "Task 1", "done": false, "dueDate": "" },
    { "id": "i_2", "text": "Task 2", "done": true, "dueDate": "2026-05-25" }
  ]
}
```

### Callout Block
```json
{
  "id": "b_6",
  "type": "callout",
  "icon": "💡",
  "text": "Important note"
}
```

### Divider Block
```json
{
  "id": "b_7",
  "type": "divider"
}
```

### Table Block
```json
{
  "id": "b_8",
  "type": "table",
  "headers": ["Name", "Email", "Status"],
  "rows": [
    { "id": "r_1", "cells": ["John", "john@example.com", "Active"] }
  ]
}
```

---

## Usage Examples

### Example 1: Create Complete Workspace with Content

```bash
# Create workspace
curl -X PUT http://127.0.0.1:3334/api/workspaces/my_project \
  -H 'content-type: application/json' \
  -d '{
    "name": "My Project",
    "data": {
      "pages": {},
      "rootOrder": [],
      "childOrder": {},
      "currentPageId": null
    }
  }'

# Create page
curl -X POST http://127.0.0.1:3334/api/workspaces/my_project/pages \
  -H 'content-type: application/json' \
  -d '{
    "title": "Project Overview",
    "blocks": []
  }'

# Add text block
curl -X POST http://127.0.0.1:3334/api/workspaces/my_project/pages/p_xyz/blocks \
  -H 'content-type: application/json' \
  -d '{
    "type": "text",
    "text": "<p>Project started on May 24, 2026</p>"
  }'
```

---

### Example 2: Bulk Update Multiple Blocks

```bash
# Get current page
RESPONSE=$(curl http://127.0.0.1:3334/api/workspaces/my_project/pages/p_xyz)

# Update blocks by patching page with new blocks array
curl -X PATCH http://127.0.0.1:3334/api/workspaces/my_project/pages/p_xyz \
  -H 'content-type: application/json' \
  -d '{
    "blocks": [
      { "id": "b_1", "type": "heading", "level": 1, "text": "Updated Title" },
      { "id": "b_2", "type": "text", "text": "<p>Updated content</p>" }
    ]
  }'
```

---

### Example 3: Fetch Specific Content and Parse

```bash
# Get workspace
curl -s http://127.0.0.1:3334/api/workspaces/churns_ai_bible | jq .

# Get specific page
curl -s http://127.0.0.1:3334/api/workspaces/churns_ai_bible/pages/p_home | jq .

# Extract blocks
curl -s http://127.0.0.1:3334/api/workspaces/churns_ai_bible/pages/p_home/blocks | jq '.blocks[].text'
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Request body must be valid JSON."
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized."
}
```

### 404 Not Found
```json
{
  "error": "Workspace not found: invalid_id"
}
```

### 409 Conflict
```json
{
  "error": "Workspace already exists: workspace_id"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error message"
}
```

---

## Data Persistence

- All data is stored in `workspace-api-store.json`
- Writes are atomic (temporary file → rename pattern)
- Each workspace object is timestamped with `createdAt` and `updatedAt`
- No automatic backups; implement your own backup strategy

---

## CORS Support

By default, the API accepts requests from all origins (`Access-Control-Allow-Origin: *`).

To restrict to specific origin:
```bash
WORKSPACE_API_ORIGIN="http://localhost:3000" node workspace-api-server.mjs
```

---

## Rate Limiting

Currently not implemented. Consider adding if exposing to public traffic.

---

## Best Practices

1. **Always use authentication** in production (`WORKSPACE_API_TOKEN`)
2. **Validate data** before sending—the API accepts any valid JSON structure
3. **Use meaningful IDs** for workspaces, pages, and blocks
4. **Backup regularly** by exporting workspace data
5. **Use PATCH** for partial updates, **PUT** for full replacements
6. **Handle timestamps** for optimistic locking (future feature)

---

## Integration Examples

### Node.js / JavaScript

```javascript
const fetch = require('node-fetch');

const API_URL = 'http://127.0.0.1:3334';
const API_TOKEN = 'your-secret-token';

async function createPage(workspaceId, title) {
  const response = await fetch(
    `${API_URL}/api/workspaces/${workspaceId}/pages`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-workspace-api-token': API_TOKEN
      },
      body: JSON.stringify({
        title,
        blocks: []
      })
    }
  );
  return response.json();
}
```

### Python

```python
import requests
import json

API_URL = 'http://127.0.0.1:3334'
API_TOKEN = 'your-secret-token'

def create_workspace(workspace_id, name):
    response = requests.put(
        f'{API_URL}/api/workspaces/{workspace_id}',
        json={
            'name': name,
            'data': {
                'pages': {},
                'rootOrder': [],
                'childOrder': {},
                'currentPageId': None
            }
        },
        headers={'x-workspace-api-token': API_TOKEN}
    )
    return response.json()
```

---

## Support & Debugging

- Check API server logs for errors
- Verify `workspace-api-store.json` exists and is readable
- Test endpoints with `curl` first before integrating
- Use `jq` to parse and inspect JSON responses: `curl ... | jq .`
