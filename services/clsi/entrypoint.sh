#!/bin/sh

# add the node user to the docker group on the host
DOCKER_GROUP=$(stat -c '%g' /var/run/docker.sock)
groupadd --non-unique --gid "${DOCKER_GROUP}" dockeronhost
usermod -aG dockeronhost node

# compatibility: initial volume setup
mkdir -p /overleaf/services/clsi/cache && chown node:node /overleaf/services/clsi/cache
mkdir -p /overleaf/services/clsi/compiles && chown node:node /overleaf/services/clsi/compiles
mkdir -p /overleaf/services/clsi/db && chown node:node /overleaf/services/clsi/db
mkdir -p /overleaf/services/clsi/output && chown node:node /overleaf/services/clsi/output

exec runuser -u node -- "$@"
