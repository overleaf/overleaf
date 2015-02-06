#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser sharelatex /usr/bin/node /var/www/sharelatex/web/app.js >> /var/log/sharelatex/web.log 2>&1