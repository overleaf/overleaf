#!/bin/bash

set -ex

# Prefer Debian packages over Ubuntu packages
echo 'APT::Default-Release "buster";' >/etc/apt/apt.conf.d/default-release

# The following aspell packages exist in Ubuntu but not Debian:
# aspell-af, aspell-id, aspell-nr, aspell-ns, aspell-st, aspell-tn, aspell-ts, aspell-xh
echo "deb [arch=amd64] http://archive.ubuntu.com/ubuntu/ focal main universe" > /etc/apt/sources.list.d/focal-amd.list
echo "deb [arch=arm64] http://ports.ubuntu.com/ubuntu-ports/ focal main universe" > /etc/apt/sources.list.d/focal-ports-arm.list
apt-key adv --no-tty --keyserver keyserver.ubuntu.com --recv-keys 3B4FE6ACC0B21F32

apt-get update
apt-get install -y aspell aspell-en aspell-af aspell-ar aspell-ar-large aspell-bg aspell-br aspell-ca aspell-cs aspell-cy aspell-da aspell-de aspell-de-1901 aspell-el aspell-eo aspell-es aspell-et aspell-eu-es aspell-fa aspell-fo aspell-fr aspell-ga aspell-gl-minimos aspell-hr aspell-hsb aspell-id aspell-it aspell-kk aspell-ku aspell-lt aspell-lv aspell-nl aspell-no aspell-nr aspell-ns  aspell-pa aspell-pl aspell-pt aspell-pt-br aspell-ro aspell-ru aspell-sk aspell-sl aspell-st aspell-sv aspell-tl aspell-tn aspell-ts aspell-xh
