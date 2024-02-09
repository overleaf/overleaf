#!/bin/bash

set -e

OLD_ITEMS=$(env | cut -d '=' -f1 | grep SHARELATEX | sed 's/^/      - /')

if [[ "$OLD_ITEMS" == "" ]]; then
  exit 0
fi

N=$(echo "$OLD_ITEMS" | wc -l)
cat <<EOF
------------------------------------------------------------------------

                   ShareLaTeX to Overleaf rebranding
                   ---------------------------------

  Starting with version 5.0, ShareLaTeX branded variables are no
   longer supported as we are migrating to the Overleaf brand.

  Your configuration still uses $N ShareLaTeX environment variables:
$OLD_ITEMS

  Please either replace them with the "OVERLEAF_" prefix,
   e.g. SHARELATEX_MONGO_URL -> OVERLEAF_MONGO_URL, or
   remove old entries from your configuration.

  You can use the following script for migrating your config.

  Overleaf toolkit setups:

    github.com/overleaf/toolkit$ bin/upgrade
    github.com/overleaf/toolkit$ bin/rename-env-vars-5-0.sh


  Legacy docker compose setups/Horizontal scaling setups:

    github.com/overleaf/overleaf$ git pull
    github.com/overleaf/overleaf$ server-ce/bin/rename-env-vars-5-0.sh

    # When using a docker-compose.override.yml file (or other file name):
    github.com/overleaf/overleaf$ server-ce/bin/rename-env-vars-5-0.sh docker-compose.override.yml


  Other deployment methods:

    Try using the docker compose script or get in touch with support.


  Refusing to startup, exiting in 10s.

------------------------------------------------------------------------
EOF

sleep 10
exit 101
