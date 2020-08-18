#!/bin/bash

npm run webpack:production & WEBPACK=$!

wait $WEBPACK && echo "Webpack complete" || exit 1
