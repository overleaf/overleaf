#!/bin/bash
set -e

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")
WEB_DIR=$(dirname "$SCRIPT_DIR")

cd "$WEB_DIR"

if [[ $(git status --porcelain=2 locales/) ]]; then
  git add locales/*
  git commit -m "auto update translation"
  # Switch the cloudbuild clone from https to ssh authentication.
  git remote set-url --push origin git@github.com:overleaf/internal.git
  git push origin "HEAD:$BRANCH_NAME"
else
  echo 'No changes'
fi
