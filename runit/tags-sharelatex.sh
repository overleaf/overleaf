#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser sharelatex /usr/bin/node /var/www/sharelatex/tags/app.js >> /var/log/sharelatex/tags.log 2>&1