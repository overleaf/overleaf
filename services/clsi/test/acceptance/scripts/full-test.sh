#!/bin/bash -x

export SHARELATEX_CONFIG=`pwd`/test/acceptance/scripts/settings.test.js

echo ">> Starting server..."

grunt --no-color >server.log 2>&1 &

echo ">> Server started"

sleep 5

echo ">> Running acceptance tests..."
grunt --no-color mochaTest:acceptance
_test_exit_code=$?

echo ">> Killing server"

kill %1

echo ">> Done"

exit $_test_exit_code
