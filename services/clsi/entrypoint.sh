#!/bin/sh

echo "Changing permissions of /var/run/docker.sock for sibling containers"
cp /var/clsi/bin/synctex /var/clsi/bin/synctex-mount/synctex

chown root:docker /var/run/docker.sock
chown app:app /app/compiles

./bin/install_texlive_gce.sh
exec runuser -u app "$@"