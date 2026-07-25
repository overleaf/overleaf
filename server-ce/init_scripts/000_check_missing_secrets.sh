#!/bin/bash

set -e

REQUIRED_SECRETS="
OVERLEAF_INVITE_TOKEN_SECRET
"

MISSING_ITEMS=""
for name in ${REQUIRED_SECRETS}; do
  if [[ -z "${!name}" ]]; then
    MISSING_ITEMS="$MISSING_ITEMS $name"
  fi
done

if [[ "$MISSING_ITEMS" == "" ]]; then
  exit 0
fi

MISSING_ITEMS=$(echo "$MISSING_ITEMS" | xargs -n1 | sed 's/^/      - /')
N=$(echo "$MISSING_ITEMS" | wc -l)
cat <<EOF
------------------------------------------------------------------------

                     Missing required secrets
                     ------------------------

  Your configuration is missing $N required secret(s):
$MISSING_ITEMS

  These secrets must be set to persistent random values and kept
   stable across container restarts and upgrades. Regenerating them
   will invalidate previously issued tokens stored in the database.

  Generate a value with, for example:

    openssl rand -base64 32


  Overleaf toolkit setups:

    Add the missing variable(s) to config/variables.env and restart:

      github.com/overleaf/toolkit$ bin/up


  docker compose setups:

    Add the missing variable(s) to the sharelatex service environment
     in docker-compose.yml (or your override file) and restart.


  Refusing to startup, exiting in 10s.

------------------------------------------------------------------------
EOF

sleep 10
exit 101
