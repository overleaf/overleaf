#! /usr/bin/env bash

echo ">> Starting server..."

grunt >> /dev/null &
_pid="$!"

echo ">> Server started with pid: $_pid"

sleep 20

echo ">> Running acceptance tests..."
grunt test:acceptance

echo ">> Killing server (pid: $_pid)"
kill -1 "$_pid"

echo ">> Done"
