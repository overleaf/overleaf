#!/usr/bin/env bash

set -eu

echo "-------------------------"
echo "Deactivating old projects"
echo "-------------------------"
date

ENABLE_CRON_RESOURCE_DELETION=$(cat /etc/container_environment/ENABLE_CRON_RESOURCE_DELETION)

if [[ "${ENABLE_CRON_RESOURCE_DELETION:-null}" != "true" ]]; then
  echo "Skipping old project deactivation due to ENABLE_CRON_RESOURCE_DELETION not set to true"
  exit 0
fi

WEB_URL='http://127.0.0.1:3000'

USER=$(cat /etc/container_environment/WEB_API_USER)
PASS=$(cat /etc/container_environment/WEB_API_PASSWORD)

curl -v -X POST                                                \
  -u "${USER}:${PASS}"                                         \
  -H "Content-Type: application/json"                          \
  -d '{"numberOfProjectsToArchive":"720","ageOfProjects":"7"}' \
  "${WEB_URL}/internal/deactivateOldProjects"

echo "Done."
