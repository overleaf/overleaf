#!/usr/bin/env bash

set -eu

echo "----------------------"
echo "Expiring deleted users"
echo "----------------------"
date

ENABLE_CRON_RESOURCE_DELETION=$(cat /etc/container_environment/ENABLE_CRON_RESOURCE_DELETION)

if [[ "${ENABLE_CRON_RESOURCE_DELETION:-null}" != "true" ]]; then
  echo "Skipping user expiration due to ENABLE_CRON_RESOURCE_DELETION not set to true"
  exit 0
fi

WEB_URL='http://127.0.0.1:3000'

USER=$(cat /etc/container_environment/WEB_API_USER)
PASS=$(cat /etc/container_environment/WEB_API_PASSWORD)

curl -X POST -v -u "${USER}:${PASS}" \
  "${WEB_URL}/internal/expire-deleted-users-after-duration"

echo "Done."
