#!/usr/bin/env bash

set -eux

echo "--------------------------"
echo "Flush project-history queue"
echo "--------------------------"
date

PROJECT_HISTORY_URL='http://localhost:3054'

curl -X POST "${PROJECT_HISTORY_URL}/flush/old?timeout=3600000&limit=5000&background=1"
