#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser www-data /usr/bin/node /var/www/sharelatex/spelling/app.js >> /var/log/sharelatex/spelling.log 2>&1