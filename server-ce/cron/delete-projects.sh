#!/usr/bin/env bash

set -eux

echo "-------------------------"
echo "Expiring deleted projects"
echo "-------------------------"
date

ENABLE_CRON_RESOURCE_DELETION=$(cat /etc/container_environment/ENABLE_CRON_RESOURCE_DELETION)

if [[ "${ENABLE_CRON_RESOURCE_DELETION:-null}" != "true" ]]; then
  echo "Skipping project expiration due to ENABLE_CRON_RESOURCE_DELETION not set to true"
  exit 0
fi

WEB_URL='http://localhost:3000'

USER=$(cat /etc/container_environment/WEB_API_USER)
PASS=$(cat /etc/container_environment/WEB_API_PASSWORD)

curl -X POST -v -u "${USER}:${PASS}" \
  "${WEB_URL}/internal/expire-deleted-projects-after-duration"

echo "Done."
