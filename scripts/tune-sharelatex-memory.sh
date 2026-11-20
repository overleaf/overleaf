#!/usr/bin/env bash
set -euo pipefail

# Idempotently tunes V8 heap/nursery limits, libuv threadpools, glibc malloc arenas,
# consolidates duplicate web + web-api processes, and lowers Nginx worker count so
# sharelatex boots and stays comfortably within the 1.5 GB total Overleaf stack RAM budget.

ensure_env_export() {
  local file="$1"
  local key="$2"
  local val="$3"
  [[ -f "$file" ]] || return 0
  if grep -qE "^export ${key}=" "$file"; then
    sed -i -E "s|^export ${key}=.*|export ${key}=${val}|" "$file"
  else
    printf 'export %s=%s\n' "$key" "$val" >> "$file"
  fi
}

patch_run_file() {
  local svc="$1"
  local mb="$2"
  local run_file="/etc/service/${svc}/run"
  [[ -f "$run_file" ]] || return 0

  python3 - "$run_file" "$mb" <<'PY'
import re, sys

path, mb = sys.argv[1], sys.argv[2]
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

flags = f"--max-old-space-size={mb} --max-semi-space-size=2"
cleaned = re.sub(r'\s*--max-(?:old|semi)-space-size=\d+', '', src)

if 'NODE_PARAMS="$NODE_PARAMS"' in cleaned:
    updated = cleaned.replace('NODE_PARAMS="$NODE_PARAMS"', f'NODE_PARAMS="$NODE_PARAMS {flags}"', 1)
elif 'NODE_PARAMS="' in cleaned and '$NODE_PARAMS' in cleaned:
    updated = re.sub(
        r'(if \[ "\$DEBUG_NODE" == "true" \]; then\s+[^\n]*\n\s+NODE_PARAMS="[^"]+"\nfi)',
        rf'\1\nNODE_PARAMS="$NODE_PARAMS {flags}"',
        cleaned,
        count=1,
    )
    if updated == cleaned:
        updated = cleaned.replace('NODE_PARAMS=""', f'NODE_PARAMS="{flags}"', 1)
else:
    updated = re.sub(
        r'(/usr/bin/node\s+)',
        rf'\1{flags} ',
        cleaned,
        count=0,
    )

if updated != src:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(updated)
    print(f"[ok] {path} -> {flags}")
else:
    print(f"[skip] {path} already configured ({flags})")
PY
}

# 1. Global threadpool and glibc arena limits for all Overleaf Node services
ensure_env_export "/etc/overleaf/env.sh" "UV_THREADPOOL_SIZE" "4"
ensure_env_export "/etc/overleaf/env.sh" "MALLOC_ARENA_MAX" "2"

if [[ -f /etc/service/history-v1-overleaf/run ]]; then
  python3 - "/etc/service/history-v1-overleaf/run" <<'PY'
import sys
p = sys.argv[1]
src = open(p, 'r', encoding='utf-8').read()
lines = src.splitlines(keepends=True)
if not any('UV_THREADPOOL_SIZE=' in l for l in lines):
    idx = 1 if lines and lines[0].startswith('#!') else 0
    lines.insert(idx, 'export UV_THREADPOOL_SIZE=4\nexport MALLOC_ARENA_MAX=2\n')
    open(p, 'w', encoding='utf-8').writelines(lines)
    print("[ok] /etc/service/history-v1-overleaf/run env exports added")
PY
fi

# 2. V8 heap and nursery caps across active Node runit services
patch_run_file "web-overleaf" 256

# Editor, real-time, and compile coordinators
patch_run_file "document-updater-overleaf" 128
patch_run_file "docstore-overleaf" 128
patch_run_file "real-time-overleaf" 128
patch_run_file "clsi-overleaf" 128

# Supporting workers and add-ons
patch_run_file "history-v1-overleaf" 96
patch_run_file "project-history-overleaf" 96
patch_run_file "filestore-overleaf" 96
patch_run_file "notifications-overleaf" 96
patch_run_file "chat-overleaf" 96
patch_run_file "package-hub" 96
patch_run_file "local-sync-overleaf" 64

# 3. Consolidate web + web-api into a single web-overleaf process on port 3000
if [[ -f /etc/service/web-overleaf/run ]]; then
  sed -i -E 's/export ENABLED_SERVICES="web"/export ENABLED_SERVICES="web,api"/' /etc/service/web-overleaf/run
  sed -i -E 's/export WEB_PORT="4000"/export WEB_PORT="3000"/' /etc/service/web-overleaf/run
  echo "[ok] web-overleaf configured for combined web,api on port 3000"
fi

if [[ -d /etc/service/web-api-overleaf ]]; then
  touch /etc/service/web-api-overleaf/down
  sv down web-api-overleaf >/dev/null 2>&1 || true
  echo "[ok] duplicate web-api-overleaf disabled (down)"
fi

if [[ -f /etc/my_init.d/910_initiate_doc_version_recovery ]]; then
  sed -i 's/waitForService web-api 4000/waitForService web-api 3000/g' /etc/my_init.d/910_initiate_doc_version_recovery
fi

if [[ -f /etc/nginx/sites-enabled/overleaf.conf ]]; then
  python3 - "/etc/nginx/sites-enabled/overleaf.conf" <<'PY'
import sys
p = sys.argv[1]
src = open(p, 'r', encoding='utf-8').read()
updated = src.replace('proxy_pass http://127.0.0.1:4000;', 'proxy_pass http://127.0.0.1:3000;')
if 'location ^~ /internal/' not in updated:
    target = '\tlocation /metrics {\n\t\tinternal;\n\t}'
    block = target + '\n\n\t# block external access to internal private-api routes after web+api consolidation\n\tlocation ^~ /internal/ {\n\t\tinternal;\n\t}'
    if target in updated:
        updated = updated.replace(target, block, 1)
if updated != src:
    open(p, 'w', encoding='utf-8').write(updated)
    print("[ok] nginx upstream updated to 127.0.0.1:3000 with /internal/ blocked")
else:
    print("[skip] nginx overleaf.conf already consolidated")
PY
fi

# 4. Reduce idle Nginx worker processes from 4 to 2 (both live config and startup template default)
if [[ -f /etc/my_init.d/200_nginx_config_template.sh ]]; then
  sed -i 's/NGINX_WORKER_PROCESSES:-4/NGINX_WORKER_PROCESSES:-2/g' /etc/my_init.d/200_nginx_config_template.sh
fi
if [[ -f /etc/nginx/nginx.conf ]]; then
  if grep -qE '^worker_processes\s+[0-9]+;' /etc/nginx/nginx.conf; then
    sed -i -E 's/^worker_processes\s+[0-9]+;/worker_processes 2;/' /etc/nginx/nginx.conf
  fi
fi
if nginx -t >/dev/null 2>&1; then
  nginx -s reload || true
  echo "[ok] nginx validated and reloaded"
fi

# 5. Clean temporary build/test staging directories and unused source files
rm -rf /tmp/pnp-backup /tmp/ol-local-sync-test-* /overleaf/services/web/frontend/js/features/project-list/components/local-folder/local-folder-banner.tsx 2>/dev/null || true

# Clean up any orphaned ad-hoc Node evaluation processes
while read -r pid ppid args; do
  [[ -z "${pid:-}" ]] && continue
  if [[ "$args" == *"node -e"* || "$args" == *"node --input-type=module"* ]]; then
    echo "[ok] killing orphaned node test process PID $pid"
    kill "$pid" 2>/dev/null || true
  fi
done < <(ps -eo pid=,ppid=,args=)
