#!/bin/sh

docker --version >&2

DOCKER_GROUP=$(stat -c '%g' /var/run/docker.sock)
groupadd --non-unique --gid ${DOCKER_GROUP} dockeronhost
usermod -aG dockeronhost node

mkdir -p /app/cache
chown -R node:node /app/cache

mkdir -p /app/compiles
chown -R node:node /app/compiles

chown -R node:node /app/bin/synctex
mkdir -p /app/test/acceptance/fixtures/tmp/
chown -R node:node /app

chown -R node:node /app/bin

cp /app/bin/synctex /app/bin/synctex-mount/synctex

exec runuser -u node -- "$@"
