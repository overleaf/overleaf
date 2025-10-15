#!/bin/sh
# Extract project IDs with pending backups older than the configured timeout (default: 10000 seconds)
RETRY_TIMEOUT="${RETRY_TIMEOUT:-10000}"
ids=$(node storage/scripts/backup_scheduler.mjs --show-pending="$RETRY_TIMEOUT" | grep '^{' | jq -r '.projectId' | sort -u)
# Retry backups for each project ID with a concurrency of 5 blob uploads at a time
for project_id in $ids ; do
  LOG_LEVEL=debug node storage/scripts/backup.mjs --projectId="$project_id" -c 2 ;
done
