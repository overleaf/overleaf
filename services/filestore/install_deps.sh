#!/bin/sh
apt-get update

apt-get install vim imagemagick optipng --yes

wget -q https://s3.amazonaws.com/sl-public-dev-assets/ghostscript-9.15.tar.gz -O /tmp/ghostscript-9.15.tar.gz
cd /tmp
tar -xvf /tmp/ghostscript-9.15.tar.gz
cd /tmp/ghostscript-9.15 && ./configure && make && make install

npm rebuild
chown -R node:node /app/uploads

echo gs --version