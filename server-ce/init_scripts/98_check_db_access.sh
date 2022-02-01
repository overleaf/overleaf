#!/bin/sh
set -e

echo "Checking can connect to mongo and redis"
cd /overleaf/services/web
node modules/server-ce-scripts/scripts/check-mongodb
node modules/server-ce-scripts/scripts/check-redis
echo "All checks passed"
