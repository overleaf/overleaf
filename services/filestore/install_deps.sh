#!/bin/sh
apt-get install poppler-utils vim ghostscript imagemagick optipng --yes
npm rebuild
chown -R node:node /app/uploads
