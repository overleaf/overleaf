#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OVERLEAF_ADMIN_EMAIL:-}" || -z "${OVERLEAF_ADMIN_PASSWORD:-}" ]]; then
  exit 0
fi

cd /overleaf/services/web
/sbin/setuser www-data node modules/launchpad/app/src/bootstrap-admin.mjs
