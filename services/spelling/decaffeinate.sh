#!/usr/bin/env bash
set -ex

# Check .eslintrc and .prettierc are present

npm install --save-dev eslint eslint-config-prettier eslint-config-standard \
    eslint-plugin-chai-expect eslint-plugin-chai-friendly eslint-plugin-import \
    eslint-plugin-mocha eslint-plugin-node eslint-plugin-prettier \
    eslint-plugin-promise eslint-plugin-standard prettier-eslint-cli

git add .
git commit -m "Decaffeinate: add eslint and prettier rc files"


echo "------------------------"
echo "----------APP-----------"
echo "------------------------"

# bulk-decaffeinate will commit for you
npx bulk-decaffeinate convert --dir app/coffee
npx bulk-decaffeinate clean

git mv app/coffee app/js
git commit -m "Rename app/coffee dir to app/js"

npx prettier-eslint 'app/js/**/*.js' --write
git add .
git commit -m "Prettier: convert app/js decaffeinated files to Prettier format"


echo "-------------------------"
echo "--------UNIT TESTS-------"
echo "-------------------------"
npx bulk-decaffeinate convert --dir test/unit/coffee
npx bulk-decaffeinate clean

git mv test/unit/coffee test/unit/js
git commit -m "Rename test/unit/coffee to test/unit/js"

npx prettier-eslint 'test/unit/js/**/*.js' --write
git add .
git commit -m "Prettier: convert test/unit decaffeinated files to Prettier format"


echo "-------------------------"
echo "-------STRESS TESTS------"
echo "-------------------------"

npx bulk-decaffeinate convert --dir test/stress/coffee
npx bulk-decaffeinate clean

git mv test/stress/coffee test/stress/js
git commit -m "Rename test/stress/coffee to test/stress/js"

npx prettier-eslint 'test/stress/js/**/*.js' --write
git add .
git commit -m "Prettier: convert test/stress decaffeinated files to Prettier format"


echo "--------------------------"
echo "-----INDIVIDUAL FILES-----"
echo "--------------------------"

rm -f app.js config/settings.defaults.js
git mv app.coffee app.js
git mv config/settings.defaults.coffee config/settings.defaults.js
git commit -m "Rename individual coffee files to js files"

decaffeinate app.js
decaffeinate config/settings.defaults.js
git add .
git commit -m "Decaffeinate: convert individual files to js"

npx prettier-eslint 'app.js' 'config/settings.defaults.js' --write

git add .
git commit -m "Prettier: convert individual decaffeinated files to Prettier format"

echo "done."