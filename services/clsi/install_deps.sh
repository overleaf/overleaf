/bin/sh
wget -qO- https://get.docker.com/ | sh
apt-get install poppler-utils vim ghostscript --yes
npm rebuild
usermod -aG docker app

touch /var/run/docker.sock
chown root:docker /var/run/docker.sock

chown -R app:app /app/cache
