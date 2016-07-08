#! /usr/bin/env bash

echo ">> Starting server..."

grunt execute:app >> /dev/null &
_pid="$!"

echo ">> Server started with pid: $_pid"

sleep 20

echo ">> Running acceptance tests..."
grunt mochaTest:acceptance
_test_exit_code=$?

echo ">> Killing server (pid: $_pid)"
kill -1 "$_pid"

echo ">> Done"

exit $_test_exit_code
