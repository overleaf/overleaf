#!/bin/sh

set -ex

apt-get update

apt-get install parallel --yes

rm -rf /var/lib/apt/lists/*
