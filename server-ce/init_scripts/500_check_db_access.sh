#!/bin/sh
set -e

echo "Checking can connect to mongo and redis"
cd /overleaf/services/web
node modules/server-ce-scripts/scripts/check-mongodb.mjs
node modules/server-ce-scripts/scripts/check-redis.mjs
echo "All checks passed"
