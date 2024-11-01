#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: transform-dir.sh <module_path>"
  exit 1
fi

MODULE_PATH=$1

while true; do
  FILES=$(node scripts/esm-check-migration.mjs -f "$MODULE_PATH" -j | jq -r '.filesNotImportedViaCjs | join(" ")')
  if [ -z "$FILES" ]; then
    break
  fi
  node transform/cjs-to-esm/cjs-to-esm.mjs $FILES
done

make format_fix > /dev/null

echo "All files processed."
