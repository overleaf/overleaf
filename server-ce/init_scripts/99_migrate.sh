#!/bin/sh
set -e

which node
which grunt
ls -al /var/www/sharelatex/migrations
cd /var/www/sharelatex && grunt migrate -v
echo "All migrations finished"
