#! env sh
./node_modules/.bin/coffee --bare -o dist/ src/coffee/latex-log-parser.coffee
./node_modules/.bin/coffee --bare -o dist/ src/coffee/bib-log-parser.coffee
