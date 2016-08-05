#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser www-data /usr/bin/node /var/www/sharelatex/notifcations/app.js >> /var/log/sharelatex/notifcations.log 2>&1