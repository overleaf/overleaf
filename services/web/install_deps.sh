#!/bin/bash

SHARELATEX_CONFIG=/app/config/settings.webpack.js npm run webpack:production & WEBPACK=$!

wait $WEBPACK && echo "Webpack complete" || exit 1
