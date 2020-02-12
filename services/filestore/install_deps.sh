#!/bin/sh

set -ex

apt-get update

apt-get install ghostscript imagemagick optipng --yes

rm -rf /var/lib/apt/lists/*
