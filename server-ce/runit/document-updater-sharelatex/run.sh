#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser www-data /usr/bin/node /var/www/sharelatex/document-updater/app.js >> /var/log/sharelatex/document-updater.log 2>&1