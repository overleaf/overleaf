#!/bin/sh

# health check to allow 404 status code as valid
STATUSCODE=$(curl --silent --output /dev/null --write-out "%{http_code}" "$1")
# will be 000 on non-http error (e.g. connection failure)
if test "$STATUSCODE" -ge 500 || test "$STATUSCODE" -lt 200; then
  exit 1
fi
exit 0
