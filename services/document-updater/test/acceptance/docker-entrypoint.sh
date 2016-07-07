#! /usr/bin/env bash

service redis-server start
service mongodb      start

cd /document-updater
npm install
grunt test:acceptance:docker
