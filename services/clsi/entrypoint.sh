#!/bin/sh

docker --version >&2

# add the node user to the docker group on the host
DOCKER_GROUP=$(stat -c '%g' /var/run/docker.sock)
groupadd --non-unique --gid ${DOCKER_GROUP} dockeronhost
usermod -aG dockeronhost node

# compatibility: initial volume setup
mkdir -p /app/cache && chown node:node /app/cache
mkdir -p /app/compiles && chown node:node /app/compiles
mkdir -p /app/db && chown node:node /app/db
mkdir -p /app/output && chown node:node /app/output

# make synctex available for remount in compiles
cp /app/bin/synctex /app/bin/synctex-mount/synctex

exec runuser -u node -- "$@"
