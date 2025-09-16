#!/bin/bash

set -e

script_dir=$(dirname "$0")
FILES_TO_FIX=$(eslint . --format compact --no-color \
  | grep 'import/no-unresolved' \
  | cut -d':' -f1 \
  | sort -u)

if [ -z "$FILES_TO_FIX" ]; then
  echo "No files with 'import/no-unresolved' errors found. Nothing to do!"
  exit 0
fi

echo "$FILES_TO_FIX" | xargs jscodeshift --parser=babel -t "$script_dir/codemods/fixMissingJsImports.mjs"

