#!/usr/bin/env bash

set -eu

echo "---------------------------------"
echo "Flush all project-history changes"
echo "---------------------------------"
date

source /etc/container_environment.sh
source /etc/overleaf/env.sh
cd /overleaf/services/project-history && /sbin/setuser www-data node scripts/flush_all.js

echo "Done flushing all project-history changes"
