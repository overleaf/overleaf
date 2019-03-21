#!/bin/bash

make --no-print-directory format & FORMAT=$!
make --no-print-directory lint & LINT=$!
npm install git+https://github.com/sharelatex/translations-sharelatex.git#master & TRANSLATIONS=$!
WEBPACK_ENV=production make minify & MINIFY=$!

echo "Waiting for lint, format, translations and minify to finish"

wait $LINT && echo "Lint complete" || exit 1
wait $FORMAT && echo "Format complete" || exit 1
wait $TRANSLATIONS && echo "Translations install complete" || exit 1
wait $MINIFY && echo "Minifiy complete" || exit 1

chmod -R 0755 /app/public
chown -R node:node /app/public

set -B

rm -rf /app/data
mkdir -p /app/data/{dumpFolder,logs,pdf,uploads,zippedProjects}
chmod -R 0755 /app/data/
chown -R node:node /app/data/
