#!/bin/bash

set -e

# pre-shutdown scripts close the site by overriding the content of SITE_MAINTENANCE_FILE,
# this script restores the original value on container restart
SITE_MAINTENANCE_FILE_BAK="$SITE_MAINTENANCE_FILE.bak.shutdown"

if [ -f "${SITE_MAINTENANCE_FILE_BAK}" ]; then
    mv -f "${SITE_MAINTENANCE_FILE_BAK}" "${SITE_MAINTENANCE_FILE}"
    rm -f "${SITE_MAINTENANCE_FILE_BAK}"
fi
