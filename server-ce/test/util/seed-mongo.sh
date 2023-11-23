#!/bin/sh
set -e

echo "Seeding mongo for e2e tests"
cd /overleaf/services/web
node modules/server-ce-scripts/scripts/seed-mongo
node modules/server-ce-scripts/scripts/check-redis
echo "mongo seeding complete"