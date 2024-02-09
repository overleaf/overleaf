#!/bin/sh
set -e

mkdir -p /var/lib/sharelatex/data
chown www-data:www-data /var/lib/sharelatex/data

mkdir -p /var/lib/sharelatex/data/user_files
chown www-data:www-data /var/lib/sharelatex/data/user_files

mkdir -p /var/lib/sharelatex/data/compiles
chown www-data:www-data /var/lib/sharelatex/data/compiles

mkdir -p /var/lib/sharelatex/data/output
chown www-data:www-data /var/lib/sharelatex/data/output

mkdir -p /var/lib/sharelatex/data/cache
chown www-data:www-data /var/lib/sharelatex/data/cache

mkdir -p /var/lib/sharelatex/data/template_files
chown www-data:www-data /var/lib/sharelatex/data/template_files

mkdir -p /var/lib/sharelatex/data/history
chown www-data:www-data /var/lib/sharelatex/data/history

mkdir -p /var/lib/sharelatex/tmp/projectHistories
chown www-data:www-data /var/lib/sharelatex/tmp/projectHistories

mkdir -p /var/lib/sharelatex/tmp/dumpFolder
chown www-data:www-data /var/lib/sharelatex/tmp/dumpFolder

mkdir -p /var/lib/sharelatex/tmp
chown www-data:www-data /var/lib/sharelatex/tmp

mkdir -p /var/lib/sharelatex/tmp/uploads
chown www-data:www-data /var/lib/sharelatex/tmp/uploads

mkdir -p /var/lib/sharelatex/tmp/dumpFolder
chown www-data:www-data /var/lib/sharelatex/tmp/dumpFolder
