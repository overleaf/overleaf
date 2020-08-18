#!/bin/bash
set -e

if [[ `git status --porcelain=2 locales/` ]]; then
  git add locales/*
  git commit -m "auto update translation"
  git push $UPSTREAM_REPO HEAD:master
else
  echo 'No changes'
fi
