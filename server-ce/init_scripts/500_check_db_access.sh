#!/bin/sh
set -e

echo "Checking can connect to mongo and redis"
cd /overleaf/services/web
/sbin/setuser www-data node modules/server-ce-scripts/scripts/check-mongodb.mjs
/sbin/setuser www-data node modules/server-ce-scripts/scripts/check-redis.mjs
echo "All checks passed"
