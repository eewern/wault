# WAULT MCP server

An [MCP](https://modelcontextprotocol.io) server that lets Claude (Desktop / Code)
read and write your **WAULT** workspaces. Built with the official
`@modelcontextprotocol/sdk` per the [build-a-server guide](https://modelcontextprotocol.io/docs/develop/build-server).

It's a thin wrapper over the WAULT REST API, authenticated with your personal
API key.

## Tools

| Tool | What it does |
|------|--------------|
| `list_workspaces` | List all workspaces (id, name, page count) |
| `list_pages` | List pages in a workspace |
| `read_page` | Read a page's full content as Markdown |
| `search_pages` | Search pages by title/content |
| `create_page` | Create a page (title + optional Markdown) |
| `update_page` | Update a page's title and/or content |
| `append_to_page` | Append Markdown to a page |

## Setup

```bash
cd mcp-server
npm install
```

Get your API key: open WAULT → **Settings → Claude MCP & API key → Generate**.

## Configure

### Claude Code (CLI)

```bash
claude mcp add wault \
  --env WAULT_API_URL=https://wault.netlify.app \
  --env WAULT_API_TOKEN=wn_your_key_here \
  -- node "/Users/eewern/Desktop/Claude project /Notion design/mcp-server/index.mjs"
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wault": {
      "command": "node",
      "args": ["/Users/eewern/Desktop/Claude project /Notion design/mcp-server/index.mjs"],
      "env": {
        "WAULT_API_URL": "https://wault.netlify.app",
        "WAULT_API_TOKEN": "wn_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop, then ask: *"List my WAULT pages"* or *"Read the XALT home page"*.

## Local development

Point at the local API server (port 3334) instead of Netlify:

```bash
WAULT_API_URL=http://localhost:3334 WAULT_API_TOKEN=wn_xxx node index.mjs
```

## Inspect / debug

```bash
npm run inspect   # opens the MCP Inspector UI
```

## Env vars

| Var | Default | Notes |
|-----|---------|-------|
| `WAULT_API_URL` | `https://wault.netlify.app` | API base URL |
| `WAULT_API_TOKEN` | — | Your `wn_…` key (required for private workspaces) |
