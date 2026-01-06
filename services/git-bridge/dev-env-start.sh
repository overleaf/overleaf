#!/bin/bash

# This script is meant to be run as root when the git bridge starts up in
# the dev environment. It ensures that the data directory is created and
# owned by the "node" user, which is the regular user git bridge runs as.

ROOT_DIR="${GIT_BRIDGE_ROOT_DIR:-/tmp/wlgb}"
mkdir -p "$ROOT_DIR"
chown node:node "$ROOT_DIR"

# Drop privileges using setpriv to avoid spawning a new process
exec setpriv --reuid=node --regid=node --init-groups make run
