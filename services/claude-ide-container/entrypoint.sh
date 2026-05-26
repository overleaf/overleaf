#!/usr/bin/env bash
# Launches the sync daemon and code-server in parallel. If either dies, the
# container exits — AiSessionManager will restart it on next session open.

set -euo pipefail

require_env() {
  if [ -z "${!1:-}" ]; then
    echo "missing required env var: $1" >&2
    exit 1
  fi
}

require_env OVERLEAF_PROJECT_ID
require_env OVERLEAF_USER_ID
require_env DOC_UPDATER_URL
require_env WEB_URL
require_env WEB_API_USER
require_env WEB_API_PASSWORD

: "${WORKSPACE_DIR:=/home/coder/workspace}"
: "${CODE_SERVER_PORT:=8080}"
: "${CODE_SERVER_BIND:=0.0.0.0}"
: "${BASE_PATH:=/}"

mkdir -p "$WORKSPACE_DIR"

# Sync daemon — logs to stdout (one JSON line per event).
node /opt/sync-daemon/app.js &
SYNC_PID=$!

# code-server. --auth none because we front it with the AiSessionProxy in the
# web service, which checks the user's Overleaf session before forwarding any
# request to this container. Container network policy must not expose this
# port publicly.
exec code-server \
  --bind-addr "${CODE_SERVER_BIND}:${CODE_SERVER_PORT}" \
  --auth none \
  --disable-telemetry \
  --disable-update-check \
  --disable-workspace-trust \
  "$WORKSPACE_DIR" &
CS_PID=$!

shutdown() {
  echo "entrypoint: SIGTERM received, stopping children" >&2
  kill "$SYNC_PID" "$CS_PID" 2>/dev/null || true
  wait
  exit 0
}
trap shutdown TERM INT

# Wait for either child to exit, then bring the container down.
wait -n "$SYNC_PID" "$CS_PID"
EXIT_CODE=$?
echo "entrypoint: child exited with code ${EXIT_CODE}, shutting down" >&2
kill "$SYNC_PID" "$CS_PID" 2>/dev/null || true
wait
exit "$EXIT_CODE"
