#!/bin/sh
set -e

echo "Checking can connect to mongo and redis"
cd /var/www/sharelatex/web/modules/server-ce-scripts/scripts
node check-mongodb
node check-redis
echo "All checks passed"
