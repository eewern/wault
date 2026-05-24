#!/bin/bash

# Start the API server with external data directory
# This ensures data persists across redeployments

export WORKSPACE_API_STORE="$HOME/Notion_Data/workspace-api-store.json"

# Ensure the data directory exists
mkdir -p "$HOME/Notion_Data"

echo "🚀 Starting Notion Workspace API Server"
echo "📁 Data directory: $WORKSPACE_API_STORE"
echo "📊 Current data: $(wc -l < "$WORKSPACE_API_STORE" 2>/dev/null || echo '0') lines"
echo ""
echo "Server running on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""

node workspace-api-server.mjs
