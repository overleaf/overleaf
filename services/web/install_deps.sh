#!/bin/bash

SHARELATEX_CONFIG=/app/config/settings.webpack.coffee npm run webpack:production & WEBPACK=$!

wait $WEBPACK && echo "Webpack complete" || exit 1
