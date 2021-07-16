#!/bin/bash

apt-cache pkgnames > /tmp/allpackages

BADPKGLIST="libjemalloc2"
NEWPKGLIST="build-essential"

echo "Searching for required -dev and -dbg packages..."
for PKG in `dpkg --get-selections | sed 's/[: ].*//'`
do
  # Make sure it's not in the ignore list
  echo $BADPKGLIST | grep -q $PKG
  if [ $? -eq 0 ]
  then
    continue
  fi
  for suffix in dev dbg dbgsym
  do
    grep -qe "^$PKG-$suffix$" /tmp/allpackages
    if [ $? -eq 0 ]
    then
      NEWPKGLIST=" $NEWPKGLIST $PKG-$suffix"
    fi
  done
done

apt-get install -y $NEWPKGLIST

