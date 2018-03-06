/bin/sh
wget -qO- https://get.docker.com/ | sh
apt-get install poppler-utils vim ghostscript --yes
npm rebuild
usermod -aG docker app

mkdir -p /app/cache
chown -R app:app /app/cache
