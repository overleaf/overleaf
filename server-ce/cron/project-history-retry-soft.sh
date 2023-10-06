#!/usr/bin/env bash

set -eux

echo "-----------------------------------"
echo "Retry project-history errors (soft)"
echo "-----------------------------------"

PROJECT_HISTORY_URL='http://localhost:3054'

curl -X POST "${PROJECT_HISTORY_URL}/retry/failures?failureType=soft&timeout=3600000&limit=10000"
