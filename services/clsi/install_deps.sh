#!/bin/bash
set -ex

apt-get update

apt-get install -y \
  poppler-utils \
  ghostscript \

rm -rf /var/lib/apt/lists/*
