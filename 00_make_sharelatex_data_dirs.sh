#!/bin/sh
mkdir -p /var/lib/sharelatex/data
chown sharelatex:sharelatex /var/lib/sharelatex/data

mkdir -p /var/lib/sharelatex/data/user_files
chown sharelatex:sharelatex /var/lib/sharelatex/data/user_files

mkdir -p /var/lib/sharelatex/data/compiles
chown sharelatex:sharelatex /var/lib/sharelatex/data/compiles

mkdir -p /var/lib/sharelatex/data/cache
chown sharelatex:sharelatex /var/lib/sharelatex/data/cache

mkdir -p /var/lib/sharelatex/tmp
chown sharelatex:sharelatex /var/lib/sharelatex/tmp

mkdir -p /var/lib/sharelatex/tmp/uploads
chown sharelatex:sharelatex /var/lib/sharelatex/tmp/uploads

mkdir -p /var/lib/sharelatex/tmp/dumpFolder
chown sharelatex:sharelatex /var/lib/sharelatex/tmp/dumpFolder