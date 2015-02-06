#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser sharelatex /usr/bin/node /var/www/sharelatex/spelling/app.js >> /var/log/sharelatex/spelling.log 2>&1