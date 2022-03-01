#!/bin/bash

set -ex

echo 'APT::Default-Release "stretch";' >/etc/apt/apt.conf.d/default-release

# The following aspell packages exist in Ubuntu but not Debian:
# aspell-af, aspell-id, aspell-nr, aspell-ns, aspell-st, aspell-tn, aspell-ts, aspell-xhu
echo "deb [arch=amd64] http://archive.ubuntu.com/ubuntu/ focal main universe" > /etc/apt/sources.list.d/focal-amd.list
echo "deb [arch=arm64] http://ports.ubuntu.com/ubuntu-ports/ focal main universe" > /etc/apt/sources.list.d/focal-ports-arm.list
apt-key adv --no-tty --keyserver keyserver.ubuntu.com --recv-keys 3B4FE6ACC0B21F32
# Need to install aspell-no from testing (buster) as broken in stable (stretch).
echo "deb http://deb.debian.org/debian/ unstable main" > /etc/apt/sources.list.d/unstable.list

apt-get update
apt-get install -y aspell aspell-en aspell-af aspell-ar aspell-ar-large aspell-bg aspell-br aspell-ca aspell-cs aspell-cy aspell-da aspell-de aspell-de-alt aspell-el aspell-eo aspell-es aspell-et aspell-eu-es aspell-fa aspell-fo aspell-fr aspell-ga aspell-gl-minimos aspell-hr aspell-hsb aspell-id aspell-it aspell-kk aspell-ku aspell-lt aspell-lv aspell-nl aspell-nr aspell-ns  aspell-pa aspell-pl aspell-pt aspell-pt-br aspell-ro aspell-ru aspell-sk aspell-sl aspell-st aspell-sv aspell-tl aspell-tn aspell-ts aspell-xh

printf 'Package: aspell-*\nPin: release a=unstable\nPin-Priority: 1337\n' \
  > /etc/apt/preferences.d/aspell-from-unstable
apt-get install aspell-no
