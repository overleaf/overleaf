#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser www-data /usr/bin/node /var/www/sharelatex/docstore/app.js >> /var/log/sharelatex/docstore.log 2>&1