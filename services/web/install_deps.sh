#!/bin/bash

set -e

WEBPACK_ENV=production make minify &
make --no-print-directory format & 
make --no-print-directory lint & 
npm install git+https://github.com/sharelatex/translations-sharelatex.git#master &
wait -n

chmod -R 0755 /app/public
chown -R node:node /app/public

set -B

rm -rf /app/data
mkdir -p /app/data/{dumpFolder,logs,pdf,uploads,zippedProjects}
chmod -R 0755 /app/data/
chown -R node:node /app/data/
