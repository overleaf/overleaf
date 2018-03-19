/bin/sh
wget -qO- https://get.docker.com/ | sh
apt-get install poppler-utils vim ghostscript --yes
npm rebuild
usermod -aG docker node

mkdir -p /app/cache
chown -R node:node /app/cache

mkdir -p /app/compiles
chown -R node:node /app/compiles

chown -R node:node /app/bin/synctex
