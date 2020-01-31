#!/bin/sh

set -ex

apt-get update

apt-get install ghostscript imagemagick optipng --yes

rm -rf /var/lib/apt/lists/*

mkdir /app/user_files/ /app/uploads/ /app/template_files/
chown -R node:node /app/user_files
chown -R node:node /app/uploads
chown -R node:node /app/template_files
