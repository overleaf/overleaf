#!/bin/sh

docker --version >&2

# add the node user to the docker group on the host
DOCKER_GROUP=$(stat -c '%g' /var/run/docker.sock)
groupadd --non-unique --gid ${DOCKER_GROUP} dockeronhost
usermod -aG dockeronhost node

# compatibility: initial volume setup
chown node:node /app/cache
chown node:node /app/compiles
chown node:node /app/db

# make synctex available for remount in compiles
cp /app/bin/synctex /app/bin/synctex-mount/synctex

exec runuser -u node -- "$@"
