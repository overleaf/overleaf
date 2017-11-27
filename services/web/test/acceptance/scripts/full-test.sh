#! /usr/bin/env bash

# If you're running on OS X, you probably need to rebuild
# some dependencies in the docker container, before it will start.
#
#npm rebuild --update-binary

echo ">> Starting server..."

grunt --no-color forever:app:start

echo ">> Waiting for Server"

count=1
max_wait=60

while [ $count -le $max_wait ]
do
  if nc -z localhost 3000
  then
    echo ">> Server Started"

		echo ">> Running acceptance tests..."
		grunt --no-color mochaTest:acceptance
		_test_exit_code=$?

		echo ">> Killing server"

		grunt --no-color forever:app:stop

		echo ">> Done"

		exit $_test_exit_code
  fi

  sleep 1
  echo -n "."
  count=$((count+1))
done
exit 1
