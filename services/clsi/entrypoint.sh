#!/bin/sh

echo "Changing permissions of /var/run/docker.sock for sibling containers"

chown root:docker /var/run/docker.sock

mkdir -p /app/cache
chown -R app:app /app/cache

mkdir -p /app/compiles
chown -R app:app /app/compiles
chmod -R 777 /app/compiles #TODO why do I need this?

./bin/install_texlive_gce.sh
exec runuser -u app "$@"