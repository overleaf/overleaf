#!/bin/bash
export SHARELATEX_CONFIG=/etc/sharelatex/settings.coffee
exec /sbin/setuser sharelatex /usr/bin/node /var/www/sharelatex/docstore/app.js >> /var/log/sharelatex/docstore.log 2>&1