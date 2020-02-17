#!/bin/sh
set -e

echo "Checking can connect to mongo and redis"
cd /var/www/sharelatex && grunt check:redis
cd /var/www/sharelatex && grunt check:mongo
echo "All checks passed"
