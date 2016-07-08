#! /usr/bin/env bash

service redis-server start
service mongodb      start

cd /document-updater
npm install


source ./test/acceptance/scripts/full-test.sh

service redis-server stop
service mongodb      stop

exit 0
