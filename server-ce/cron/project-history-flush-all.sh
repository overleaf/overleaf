#!/usr/bin/env bash

set -eux

echo "---------------------------------"
echo "Flush all project-history changes"
echo "---------------------------------"
date

source /etc/container_environment.sh
source /etc/overleaf/env.sh
cd /overleaf/services/project-history && node scripts/flush_all.js

echo "Done flushing all project-history changes"
