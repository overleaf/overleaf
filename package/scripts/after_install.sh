#!/bin/sh
# Create random secret keys (twice, once for http auth pass, once for cookie secret).
sed -i "0,/CRYPTO_RANDOM/s/CRYPTO_RANDOM/$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 64 | head -n 1)/" /etc/sharelatex/settings.coffee
sed -i "0,/CRYPTO_RANDOM/s/CRYPTO_RANDOM/$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 64 | head -n 1)/" /etc/sharelatex/settings.coffee

sudo adduser --system --group --home /var/www/sharelatex --no-create-home sharelatex

mkdir -p /var/log/sharelatex
chown sharelatex:sharelatex /var/log/sharelatex

mkdir -p /var/lib/sharelatex
mkdir -p /var/lib/sharelatex/data/user_files
mkdir -p /var/lib/sharelatex/tmp/uploads
mkdir -p /var/lib/sharelatex/data/compiles
mkdir -p /var/lib/sharelatex/data/cache
mkdir -p /var/lib/sharelatex/tmp/dumpFolder
chown -R sharelatex:sharelatex /var/lib/sharelatex
service sharelatex-web restart
service sharelatex-document-updater restart
service sharelatex-clsi restart
service sharelatex-filestore restart
service sharelatex-track-changes restart
service sharelatex-docstore restart
service sharelatex-chat restart
service sharelatex-tags restart
service sharelatex-spelling restart
service sharelatex-real-time restart
