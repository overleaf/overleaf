#!/usr/bin/env bash

set -eu

echo "-----------------------------------"
echo "Retry project-history errors (hard)"
echo "-----------------------------------"
date

PROJECT_HISTORY_URL='http://127.0.0.1:3054'

curl -X POST "${PROJECT_HISTORY_URL}/retry/failures?failureType=hard&timeout=3600000&limit=10000"
