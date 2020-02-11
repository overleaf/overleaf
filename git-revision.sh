#!/bin/sh

for gitDir in $(find "$PWD" -name .git); do
  echo -n "$(dirname ${gitDir}),"
  git --git-dir="$gitDir" rev-parse HEAD
done
