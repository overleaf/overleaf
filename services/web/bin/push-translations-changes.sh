#!/bin/bash
set -e

if [[ -z "$BRANCH_NAME" ]]; then
  BRANCH_NAME=master
fi

if [[ `git status --porcelain=2 locales/` ]]; then
  git add locales/*
  git commit -m "auto update translation"
  git push "$UPSTREAM_REPO" "HEAD:$BRANCH_NAME"
else
  echo 'No changes'
fi
