#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser sharelatex /usr/bin/node /var/www/sharelatex/track-changes/app.js >> /var/log/sharelatex/track-changes.log 2>&1