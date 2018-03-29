#!/bin/sh

echo "Changing permissions of /var/run/docker.sock for sibling containers"

chown root:docker /var/run/docker.sock

mkdir -p /app/cache
chown -R node:node /app/cache

mkdir -p /app/compiles
chown -R node:node /app/compiles

./bin/install_texlive_gce.sh
echo "HELOOOo"
echo "$@"
exec runuser -u node "$@"