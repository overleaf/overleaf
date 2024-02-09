#!/bin/bash

set -euo pipefail

FILE=${1:-docker-compose.yml}
if [[ ! -f "$FILE" ]]; then
  echo "Expected to find $FILE, are you in the wrong directory?"
  exit 2
fi

BACKUP_FILE="$FILE.$(date '+%Y.%m.%d-%H.%M.%S')"
echo "Creating backup file $BACKUP_FILE"
cp "$FILE" "$BACKUP_FILE"

echo "Replacing 'SHARELATEX_' with 'OVERLEAF_' in $FILE"
sed -i "s/SHARELATEX_/OVERLEAF_/g" "$FILE"

echo "Done."
