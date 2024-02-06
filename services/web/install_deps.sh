#!/bin/bash

OVERLEAF_CONFIG=/overleaf/services/web/config/settings.webpack.js npm run webpack:production & WEBPACK=$!

wait $WEBPACK && echo "Webpack complete" || exit 1
