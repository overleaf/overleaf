set -ex

npx bulk-decaffeinate convert --dir app/coffee

npx bulk-decaffeinate clean

git mv app/coffee app/js

git commit -m "Rename app/coffee dir to app/js"

npx prettier-eslint 'app/js/**/*.js' --write

git add .
git commit -m "Prettier: convert app/js decaffeinated files to Prettier format"

npx bulk-decaffeinate convert --dir test/acceptance/coffee

npx bulk-decaffeinate clean

git mv test/acceptance/coffee test/acceptance/js

git commit -m "Rename test/acceptance/coffee to test/acceptance/js"

npx prettier-eslint 'test/acceptance/js/**/*.js' --write

git add .
git commit -m "Prettier: convert test/acceptance decaffeinated files to Prettier format"

echo "done"