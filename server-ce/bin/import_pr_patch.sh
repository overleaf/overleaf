#!/bin/bash

for PR in "$@"; do
  gh pr diff "$PR" --patch \
  | node -e 'const blob = require("fs").readFileSync("/dev/stdin", "utf-8"); console.log(blob.replace(/From [\s\S]+?\d+ files? changed,.+/g, ""))' \
  > "pr_$PR.patch"
done
