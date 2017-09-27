#! /usr/bin/env bash

# If you're running on OS X, you probably need to manually
# 'rm -r node_modules/bcrypt; npm install bcrypt' inside
# the docker container, before it will start.
# npm rebuild bcrypt

echo ">> Starting server..."

grunt --no-color forever:app:start

echo ">> Server started"

sleep 5

echo ">> Running acceptance tests..."
grunt --no-color mochaTest:acceptance
_test_exit_code=$?

echo ">> Killing server"

grunt --no-color forever:app:stop

echo ">> Done"

exit $_test_exit_code