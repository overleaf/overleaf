#!/bin/sh

echo "Changing permissions of /var/run/docker.sock for sibling containers"
ls -al /var/run/docker.sock
docker --version
cat /etc/passwd
usermod -aG docker node
chown root:docker /var/run/docker.sock

mkdir -p /app/cache
chown -R node:node /app/cache

mkdir -p /app/compiles
chown -R node:node /app/compiles

chown -R node:node /app/bin/synctex
mkdir -p /app/test/acceptance/fixtures/tmp/
chown -R node:node /app

chown -R node:node /app/bin

./bin/install_texlive_gce.sh
exec runuser -u node "$*"
