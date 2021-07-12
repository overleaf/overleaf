#!/bin/sh
set -e

echo "Checking can connect to mongo and redis"
cd /var/www/sharelatex/web
node scripts/server-ce/check-mongodb
node scripts/server-ce/check-redis
echo "All checks passed"
