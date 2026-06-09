#!/usr/bin/env bash
# ============================================================================
#  WAULT diagnostics — check every moving part in one shot.
#  Run anytime:   bash diagnose.sh
#  Or just tell Claude:  "run the WAULT diagnostic"
#
#  Optional env overrides:
#    WEB_PORT       (default 8899)  port the static app server runs on
#    API_PORT       (default 3334)  port the workspace API server runs on
#    WAULT_API_URL  (default the local API)  remote/prod API base to test
#    WAULT_API_TOKEN              your wn_ key, used for authed checks
# ============================================================================
set -u
WEB_PORT="${WEB_PORT:-8899}"
API_PORT="${API_PORT:-3334}"
API_URL="${WAULT_API_URL:-http://localhost:${API_PORT}}"
TOKEN="${WAULT_API_TOKEN:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

pass=0; fail=0; warn=0
ok()   { echo "  ✅ $1"; pass=$((pass+1)); }
bad()  { echo "  ❌ $1"; fail=$((fail+1)); }
note() { echo "  ⚠️  $1"; warn=$((warn+1)); }
hdr()  { echo; echo "── $1 ──"; }

echo "============================================"
echo " WAULT diagnostic — $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# 1. Static web app (the index.html + jsx served locally) -------------------
hdr "1. Web app (static server, port ${WEB_PORT})"
code=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}/" 2>/dev/null)
if [ "$code" = "200" ]; then
  ok "Serving on http://localhost:${WEB_PORT} (HTTP 200)"
  if curl -s -m 5 "http://localhost:${WEB_PORT}/" | grep -qi "<title>WAULT</title>"; then
    ok "Page title is WAULT"
  else
    note "Page served but title isn't WAULT — wrong folder?"
  fi
else
  bad "No app on :${WEB_PORT} (got '${code:-no response}')"
  echo "       start it:  cd \"$HERE\" && python3 -m http.server ${WEB_PORT}"
fi

# 2. Workspace API server ----------------------------------------------------
hdr "2. Workspace API server (port ${API_PORT})"
health=$(curl -s -m 5 "http://localhost:${API_PORT}/health" 2>/dev/null)
if echo "$health" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  ok "API healthy on http://localhost:${API_PORT}/health"
  echo "$health" | grep -q '"firebaseDatabaseConfigured":true' \
    && ok "Firebase DB configured" || note "Firebase DB not configured (local-file mode)"
  echo "$health" | grep -q '"staticTokenConfigured":true' \
    && ok "API token configured" || note "No static API token set (open access)"
else
  bad "API not responding on :${API_PORT}/health"
  echo "       start it:  cd \"$HERE\" && node workspace-api-server.mjs"
fi

# 3. MCP server file ---------------------------------------------------------
hdr "3. MCP server"
if [ -f "$HERE/mcp-server/index.mjs" ]; then
  if node --check "$HERE/mcp-server/index.mjs" 2>/dev/null; then
    ok "mcp-server/index.mjs present and valid JS"
  else
    bad "mcp-server/index.mjs has a syntax error"
  fi
  [ -d "$HERE/mcp-server/node_modules" ] \
    && ok "MCP dependencies installed" \
    || note "Run 'npm install' in mcp-server (deps missing)"
else
  bad "mcp-server/index.mjs not found"
fi

# 4. Configured API URL reachability (prod / whatever MCP will call) ---------
hdr "4. Configured API URL  (${API_URL})"
auth=(); [ -n "$TOKEN" ] && auth=(-H "Authorization: Bearer ${TOKEN}")
# ${auth[@]+...} keeps this safe under `set -u` with an empty array (macOS bash 3.2).
body=$(curl -s -m 8 ${auth[@]+"${auth[@]}"} "${API_URL}/api/workspaces" 2>/dev/null)
code=$(curl -s -m 8 ${auth[@]+"${auth[@]}"} -o /dev/null -w "%{http_code}" "${API_URL}/api/workspaces" 2>/dev/null)
if echo "$body" | grep -q '"workspaces"'; then
  n=$(echo "$body" | grep -o '"id"' | wc -l | tr -d ' ')
  ok "Reachable and returned workspace JSON (~${n} workspace ids)"
elif echo "$body" | grep -qi "<!DOCTYPE html>"; then
  bad "URL returned an HTML page, not the WAULT API (HTTP ${code})"
  echo "       This URL returned the static site, not the API. usewault.netlify.app"
  echo "       serves the frontend only — the API isn't deployed there. Point"
  echo "       WAULT_API_URL at the local API:  export WAULT_API_URL=http://localhost:${API_PORT}"
elif [ "$code" = "401" ] || [ "$code" = "403" ]; then
  note "Reachable but auth failed (HTTP ${code}) — set WAULT_API_TOKEN"
else
  bad "No valid API response (HTTP ${code:-none})"
fi

# 5. Summary -----------------------------------------------------------------
hdr "Summary"
echo "  ${pass} passed · ${warn} warnings · ${fail} failed"
echo
if [ "$fail" -eq 0 ]; then
  echo "  🟢 All critical checks passed."
else
  echo "  🔴 ${fail} critical issue(s) above — see the start-it / fix hints."
fi
echo "============================================"
exit 0
