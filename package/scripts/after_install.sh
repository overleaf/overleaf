#!/bin/sh
sudo adduser --system --group --home /var/www/sharelatex --no-create-home sharelatex

mkdir -p /var/log/sharelatex
chown sharelatex:sharelatex /var/log/sharelatex
mkdir -p /var/data/sharelatex/user_files
chown sharelatex:sharelatex /var/data/sharelatex/user_files
mkdir -p /var/data/sharelatex/uploads
chown sharelatex:sharelatex /var/data/sharelatex/uploads
mkdir -p /var/data/sharelatex/compiles
chown sharelatex:sharelatex /var/data/sharelatex/compiles
mkdir -p /var/data/sharelatex/cache
chown sharelatex:sharelatex /var/data/sharelatex/cache
mkdir -p /var/data/sharelatex/dump
chown sharelatex:sharelatex /var/data/sharelatex/dump
service sharelatex-web restart
service sharelatex-document-updater restart
service sharelatex-clsi restart
service sharelatex-filestore restart
service sharelatex-track-changes restart
service sharelatex-docstore restart
