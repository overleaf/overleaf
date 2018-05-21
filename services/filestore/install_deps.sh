#!/bin/sh
apt-get update

apt-get install vim imagemagick optipng --yes

wget -q https://s3.amazonaws.com/sl-public-dev-assets/ghostscript-9.15.tar.gz -O /tmp/ghostscript-9.15.tar.gz
cd /tmp
tar -xvf /tmp/ghostscript-9.15.tar.gz
cd /tmp/ghostscript-9.15 && ./configure && make && make install
npm rebuild
mkdir /app/user_files/ /app/uploads/ /app/template_files/
chown -R node:node /app/user_files
chown -R node:node /app/uploads
chown -R node:node /app/template_files
ls -al /app