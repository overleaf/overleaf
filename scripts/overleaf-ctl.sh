#!/usr/bin/env bash
set -euo pipefail

# Cross-Unix (Linux / macOS) lifecycle & hibernation controller for Overleaf CE.
#
# Actions:
#   pause | off | stop              Backup MongoDB & Redis to host disk, then stop containers cleanly to free RAM.
#   resume | on | start [--restore [archive]]
#                                   Start containers, enforce <= 1.5 GB RAM limits, auto-restore DB if empty (or --restore), wait for readiness.
#   backup                          Take an online verified MongoDB + Redis backup without stopping Overleaf.
#   status                          Show container state, memory usage, and latest hibernation backup metadata.

resolve_script_dir() {
  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir
    dir="$(cd -P "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd -P "$(dirname "$src")" && pwd
}

SCRIPT_DIR="$(resolve_script_dir)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -n "${OVERLEAF_TOOLKIT_DIR:-}" && -d "$OVERLEAF_TOOLKIT_DIR" ]]; then
  TOOLKIT_ROOT="$OVERLEAF_TOOLKIT_DIR"
elif [[ -f "$PARENT_DIR/config/overleaf.rc" ]]; then
  TOOLKIT_ROOT="$PARENT_DIR"
elif [[ -f "$PARENT_DIR/overleaf-toolkit/config/overleaf.rc" ]]; then
  TOOLKIT_ROOT="$PARENT_DIR/overleaf-toolkit"
elif [[ -f "$HOME/overleaf-toolkit/config/overleaf.rc" ]]; then
  TOOLKIT_ROOT="$HOME/overleaf-toolkit"
else
  TOOLKIT_ROOT="$PARENT_DIR"
fi

SHARELATEX_CONTAINER="${OVERLEAF_SHARELATEX_CONTAINER:-sharelatex}"
MONGO_CONTAINER="${OVERLEAF_MONGO_CONTAINER:-mongo}"
REDIS_CONTAINER="${OVERLEAF_REDIS_CONTAINER:-redis}"
MONGO_DB="${OVERLEAF_MONGO_DB:-sharelatex}"
BACKUP_DIR="${OVERLEAF_BACKUP_DIR:-$TOOLKIT_ROOT/data/backups/hibernate}"
KEEP_BACKUPS="${OVERLEAF_KEEP_BACKUPS:-5}"

SHARELATEX_MEM_LIMIT="${OVERLEAF_SHARELATEX_MEM:-1184m}"
SHARELATEX_SWAP_LIMIT="${OVERLEAF_SHARELATEX_SWAP:-1792m}"
MONGO_MEM_LIMIT="${OVERLEAF_MONGO_MEM:-288m}"
MONGO_SWAP_LIMIT="${OVERLEAF_MONGO_SWAP:-512m}"
REDIS_MEM_LIMIT="${OVERLEAF_REDIS_MEM:-64m}"
REDIS_SWAP_LIMIT="${OVERLEAF_REDIS_SWAP:-96m}"

read_port_from_rc() {
  local rc_file="$TOOLKIT_ROOT/config/overleaf.rc"
  if [[ -f "$rc_file" ]]; then
    local val
    val="$(grep -E '^OVERLEAF_PORT=' "$rc_file" | tail -n1 | cut -d= -f2- | tr -d '"\r' || true)"
    if [[ -n "$val" ]]; then
      echo "$val"
      return
    fi
  fi
  echo "80"
}

OVERLEAF_PORT="${OVERLEAF_PORT:-$(read_port_from_rc)}"

usage() {
  cat <<EOF
Overleaf Lifecycle & Hibernation Controller (Linux / macOS)

Usage:
  $(basename "$0") pause | off           Backup database to host disk and stop Overleaf containers cleanly
  $(basename "$0") resume | on [--restore [ARCHIVE]]
                               Start containers, verify/restore database if needed, enforce <= 1.5 GB RAM cap
  $(basename "$0") backup                Run verified online MongoDB + Redis backup without stopping containers
  $(basename "$0") status                Show container states, memory usage, and latest backup snapshot
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Error: docker CLI is not installed or not in PATH." >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker daemon is not running or inaccessible." >&2
    exit 1
  fi
}

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

container_running() {
  local state
  state="$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo "false")"
  [[ "$state" == "true" ]]
}

compute_sha256() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $NF}'
  else
    echo "unavailable"
  fi
}

query_mongo_counts() {
  docker exec -e NODE_OPTIONS=--max-old-space-size=96 "$MONGO_CONTAINER" mongosh --quiet --eval "
    const d = db.getSiblingDB('${MONGO_DB}');
    print(JSON.stringify({
      users: d.users.countDocuments({}),
      projects: d.projects.countDocuments({}),
      docs: d.docs.countDocuments({}),
      workspaceSettings: d.workspaceSettings.countDocuments({})
    }));
  " 2>/dev/null | tail -n 1 || echo '{"users":-1,"projects":-1,"docs":-1,"workspaceSettings":-1}'
}

perform_backup() {
  mkdir -p "$BACKUP_DIR"
  local ts archive_file latest_file counts_json users_count projects_count docs_count settings_count sha

  ts="$(date -u +%Y%m%d-%H%M%S)"
  archive_file="$BACKUP_DIR/${MONGO_DB}-${ts}.archive.gz"
  latest_file="$BACKUP_DIR/latest.archive.gz"
  counts_json='{"users":0,"projects":0,"docs":0,"workspaceSettings":0}'

  if ! container_running "$MONGO_CONTAINER"; then
    echo "Error: MongoDB container '$MONGO_CONTAINER' is not running; cannot create database backup." >&2
    return 1
  fi

  counts_json="$(query_mongo_counts)"
  echo "[backup] Querying live database counts ($MONGO_DB): $counts_json"
  echo "[backup] Dumping MongoDB database '$MONGO_DB' -> $archive_file ..."
  docker exec "$MONGO_CONTAINER" mongodump --db "$MONGO_DB" --archive --gzip > "$archive_file"

  if [[ ! -s "$archive_file" ]]; then
    echo "Error: MongoDB backup archive is empty: $archive_file" >&2
    rm -f "$archive_file"
    return 1
  fi

  if ! gzip -t "$archive_file" >/dev/null 2>&1; then
    echo "Error: MongoDB backup archive failed gzip integrity check: $archive_file" >&2
    return 1
  fi

  sha="$(compute_sha256 "$archive_file")"
  cp "$archive_file" "$latest_file"
  printf '%s  latest.archive.gz\n' "$sha" > "$BACKUP_DIR/latest.archive.gz.sha256"

  if container_running "$REDIS_CONTAINER"; then
    echo "[backup] Flushing Redis state cleanly to disk..."
    docker exec "$REDIS_CONTAINER" redis-cli SAVE >/dev/null || true
    docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "$BACKUP_DIR/redis-latest.rdb" >/dev/null 2>&1 || true
  fi

  # Extract counts reliably without external dependencies
  users_count="$(echo "$counts_json" | sed -n 's/.*"users":\([0-9-]*\).*/\1/p')"
  projects_count="$(echo "$counts_json" | sed -n 's/.*"projects":\([0-9-]*\).*/\1/p')"
  docs_count="$(echo "$counts_json" | sed -n 's/.*"docs":\([0-9-]*\).*/\1/p')"
  settings_count="$(echo "$counts_json" | sed -n 's/.*"workspaceSettings":\([0-9-]*\).*/\1/p')"

  cat > "$BACKUP_DIR/latest-state.json" <<JSON
{
  "timestampUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": "${MONGO_DB}",
  "archiveFile": "$(basename "$archive_file")",
  "latestFile": "latest.archive.gz",
  "sha256": "${sha}",
  "counts": {
    "users": ${users_count:-0},
    "projects": ${projects_count:-0},
    "docs": ${docs_count:-0},
    "workspaceSettings": ${settings_count:-0}
  }
}
JSON

  # Prune older timestamped backups keeping newest $KEEP_BACKUPS
  local idx=0
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    idx=$((idx + 1))
    if (( idx > KEEP_BACKUPS )); then
      rm -f "$f"
    fi
  done < <(ls -1t "$BACKUP_DIR/${MONGO_DB}-"*.archive.gz 2>/dev/null || true)

  echo "[ok] Verified backup saved: $latest_file (sha256: $sha)"
}

apply_memory_limits() {
  if container_running "$MONGO_CONTAINER"; then
    docker update --memory "$MONGO_MEM_LIMIT" --memory-swap "$MONGO_SWAP_LIMIT" "$MONGO_CONTAINER" >/dev/null 2>&1 || true
    docker exec -e NODE_OPTIONS=--max-old-space-size=96 "$MONGO_CONTAINER" mongosh --quiet --eval \
      'db.adminCommand({ setParameter: 1, wiredTigerEngineRuntimeConfig: "cache_size=128M" })' >/dev/null 2>&1 || true
  fi
  if container_running "$REDIS_CONTAINER"; then
    docker update --memory "$REDIS_MEM_LIMIT" --memory-swap "$REDIS_SWAP_LIMIT" "$REDIS_CONTAINER" >/dev/null 2>&1 || true
    docker exec "$REDIS_CONTAINER" redis-cli CONFIG SET maxmemory 48mb >/dev/null 2>&1 || true
    docker exec "$REDIS_CONTAINER" redis-cli CONFIG SET maxmemory-policy noeviction >/dev/null 2>&1 || true
  fi
  if container_running "$SHARELATEX_CONTAINER"; then
    docker update --memory "$SHARELATEX_MEM_LIMIT" --memory-swap "$SHARELATEX_SWAP_LIMIT" "$SHARELATEX_CONTAINER" >/dev/null 2>&1 || true
  fi
}

wait_for_mongo() {
  local i
  for i in $(seq 1 45); do
    if docker exec -e NODE_OPTIONS=--max-old-space-size=96 "$MONGO_CONTAINER" mongosh --quiet --eval 'db.adminCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
      # Ensure single-node replica set is initialized and writable
      local is_primary
      is_primary="$(docker exec -e NODE_OPTIONS=--max-old-space-size=96 "$MONGO_CONTAINER" mongosh --quiet --eval 'Boolean(db.hello().isWritablePrimary || db.hello().ismaster)' 2>/dev/null | tail -n 1 || echo "false")"
      if [[ "$is_primary" == "true" ]]; then
        return 0
      fi
      docker exec -e NODE_OPTIONS=--max-old-space-size=96 "$MONGO_CONTAINER" mongosh --quiet --eval \
        'try { rs.status().ok || rs.initiate({ _id: "overleaf", members: [{ _id: 0, host: "mongo:27017" }] }) } catch(e) { rs.initiate({ _id: "overleaf", members: [{ _id: 0, host: "mongo:27017" }] }) }' >/dev/null 2>&1 || true
    fi
    sleep 1
  done
  echo "Error: Timed out waiting for MongoDB primary readiness." >&2
  return 1
}

wait_for_redis() {
  local i
  for i in $(seq 1 30); do
    if [[ "$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | tr -d '\r')" == "PONG" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Error: Timed out waiting for Redis readiness." >&2
  return 1
}

wait_for_web() {
  local i code
  local url="http://127.0.0.1:${OVERLEAF_PORT}/login"
  for i in $(seq 1 90); do
    if command -v curl >/dev/null 2>&1; then
      code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
      if [[ "$code" == "200" || "$code" == "302" ]]; then
        return 0
      fi
    elif docker exec "$SHARELATEX_CONTAINER" bash -lc 'curl -sf -o /dev/null http://127.0.0.1:4000/login' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Warning: Overleaf web did not respond on $url within 90s; check logs." >&2
  return 1
}

cmd_pause() {
  require_docker
  echo "=== Hibernating Overleaf Workspace (Pause & Backup) ==="

  if container_running "$SHARELATEX_CONTAINER"; then
    echo "[stop] Gracefully stopping '$SHARELATEX_CONTAINER' (flushing open documents)..."
    docker stop -t 60 "$SHARELATEX_CONTAINER" >/dev/null
  else
    echo "[info] '$SHARELATEX_CONTAINER' is already stopped."
  fi

  if container_running "$MONGO_CONTAINER"; then
    perform_backup
  else
    echo "[info] MongoDB container '$MONGO_CONTAINER' is already stopped; skipping dump."
  fi

  for c in "$REDIS_CONTAINER" "$MONGO_CONTAINER"; do
    if container_running "$c"; then
      echo "[stop] Stopping '$c'..."
      docker stop -t 30 "$c" >/dev/null
    fi
  done

  echo ""
  echo "[ok] Overleaf is now OFF. Host memory from Overleaf containers is freed (0 MiB active RAM)."
  echo "[ok] Database & projects remain persisted on disk + backed up in: $BACKUP_DIR/latest.archive.gz"
  echo "Run the following command to resume from where you stopped:"
  echo "  $SCRIPT_DIR/$(basename "$0") resume"
}

cmd_resume() {
  local force_restore="false"
  local custom_archive=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --restore)
        force_restore="true"
        if [[ -n "${2:-}" && "${2:-}" != --* ]]; then
          custom_archive="$2"
          shift
        fi
        ;;
      *)
        echo "Unknown resume option: $1" >&2
        usage
        exit 1
        ;;
    esac
    shift
  done

  require_docker
  echo "=== Resuming Overleaf Workspace ==="

  if ! container_exists "$MONGO_CONTAINER" || ! container_exists "$REDIS_CONTAINER" || ! container_exists "$SHARELATEX_CONTAINER"; then
    if [[ -x "$TOOLKIT_ROOT/bin/up" ]]; then
      echo "[start] Missing container(s); provisioning via toolkit bin/up -d..."
      "$TOOLKIT_ROOT/bin/up" -d
    else
      echo "Error: Containers not found and $TOOLKIT_ROOT/bin/up missing." >&2
      exit 1
    fi
  else
    echo "[start] Starting database & cache containers ('$MONGO_CONTAINER', '$REDIS_CONTAINER')..."
    docker start "$MONGO_CONTAINER" "$REDIS_CONTAINER" >/dev/null
  fi

  wait_for_mongo
  wait_for_redis
  apply_memory_limits

  # Check whether database needs restore (explicit --restore or empty DB with existing backup)
  local archive_to_restore="${custom_archive:-$BACKUP_DIR/latest.archive.gz}"
  local live_counts live_users live_projects saved_users saved_projects
  live_counts="$(query_mongo_counts)"
  live_users="$(echo "$live_counts" | sed -n 's/.*"users":\([0-9-]*\).*/\1/p')"
  live_projects="$(echo "$live_counts" | sed -n 's/.*"projects":\([0-9-]*\).*/\1/p')"

  saved_users=0
  saved_projects=0
  if [[ -f "$BACKUP_DIR/latest-state.json" ]]; then
    saved_users="$(sed -n 's/.*"users": *\([0-9]*\).*/\1/p' "$BACKUP_DIR/latest-state.json" | head -n1 || echo 0)"
    saved_projects="$(sed -n 's/.*"projects": *\([0-9]*\).*/\1/p' "$BACKUP_DIR/latest-state.json" | head -n1 || echo 0)"
  fi

  local should_restore="false"
  if [[ "$force_restore" == "true" ]]; then
    should_restore="true"
  elif [[ "${live_users:-0}" == "0" && "${live_projects:-0}" == "0" ]] && [[ -f "$archive_to_restore" ]] && (( ${saved_users:-0} > 0 || ${saved_projects:-0} > 0 )); then
    echo "[restore] Live database is empty while snapshot records ${saved_users:-0} user(s) / ${saved_projects:-0} project(s). Restoring automatically..."
    should_restore="true"
  fi

  if [[ "$should_restore" == "true" ]]; then
    if [[ ! -f "$archive_to_restore" ]]; then
      echo "Error: Requested restore archive not found: $archive_to_restore" >&2
      exit 1
    fi
    if ! gzip -t "$archive_to_restore" >/dev/null 2>&1; then
      echo "Error: Archive failed gzip check: $archive_to_restore" >&2
      exit 1
    fi
    if [[ -f "$BACKUP_DIR/latest-state.json" && "$archive_to_restore" == "$BACKUP_DIR/latest.archive.gz" ]]; then
      local expected_sha actual_sha
      expected_sha="$(sed -n 's/.*"sha256": *"\([^"]*\)".*/\1/p' "$BACKUP_DIR/latest-state.json" | head -n1 || true)"
      actual_sha="$(compute_sha256 "$archive_to_restore")"
      if [[ -n "$expected_sha" && "$expected_sha" != "unavailable" && "$actual_sha" != "$expected_sha" ]]; then
        echo "Error: SHA-256 mismatch on $archive_to_restore (expected $expected_sha, got $actual_sha)." >&2
        exit 1
      fi
    fi
    echo "[restore] Restoring MongoDB from $archive_to_restore..."
    docker exec -i "$MONGO_CONTAINER" mongorestore --archive --gzip --drop < "$archive_to_restore"
    live_counts="$(query_mongo_counts)"
    echo "[ok] Restored database state: $live_counts"
  else
    echo "[ok] Live MongoDB data intact ($live_counts); preserving persistent state."
  fi

  if ! container_running "$SHARELATEX_CONTAINER"; then
    echo "[start] Starting '$SHARELATEX_CONTAINER'..."
    docker start "$SHARELATEX_CONTAINER" >/dev/null
  fi

  apply_memory_limits
  echo "[wait] Waiting for Overleaf web on http://localhost:${OVERLEAF_PORT} ..."
  wait_for_web

  echo ""
  echo "[ok] Overleaf is back ONLINE at http://localhost:${OVERLEAF_PORT}"
  docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" "$SHARELATEX_CONTAINER" "$MONGO_CONTAINER" "$REDIS_CONTAINER"
}

cmd_status() {
  require_docker
  echo "=== Overleaf Workspace Status ==="
  docker ps -a --filter "name=^/(${SHARELATEX_CONTAINER}|${MONGO_CONTAINER}|${REDIS_CONTAINER})$" \
    --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  if container_running "$SHARELATEX_CONTAINER" || container_running "$MONGO_CONTAINER" || container_running "$REDIS_CONTAINER"; then
    echo "=== Live Memory Budget (Target <= 1.5 GB total) ==="
    local running=()
    for c in "$SHARELATEX_CONTAINER" "$MONGO_CONTAINER" "$REDIS_CONTAINER"; do
      container_running "$c" && running+=("$c")
    done
    if (( ${#running[@]} > 0 )); then
      docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" "${running[@]}"
    fi
  fi
  echo ""
  if [[ -f "$BACKUP_DIR/latest-state.json" ]]; then
    echo "=== Latest Hibernate Snapshot ==="
    cat "$BACKUP_DIR/latest-state.json"
  else
    echo "No hibernate snapshot taken yet (directory: $BACKUP_DIR)."
  fi
}

ACTION="${1:-status}"
shift || true

case "$ACTION" in
  pause|off|stop)
    cmd_pause "$@"
    ;;
  resume|on|start)
    cmd_resume "$@"
    ;;
  backup)
    require_docker
    perform_backup
    ;;
  status)
    cmd_status
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $ACTION" >&2
    usage
    exit 1
    ;;
esac
