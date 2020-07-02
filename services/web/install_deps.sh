#!/bin/bash

npm install git+https://github.com/sharelatex/translations-sharelatex.git#master & TRANSLATIONS=$!

npm run webpack:production & WEBPACK=$!

echo "Waiting for translations and minify to finish"

wait $TRANSLATIONS && echo "Translations install complete" || exit 1
wait $WEBPACK && echo "Webpack complete" || exit 1
