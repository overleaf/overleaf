#! /usr/bin/env bash

# npm rebuild

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
