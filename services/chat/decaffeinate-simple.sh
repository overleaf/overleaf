set -ex

npx bulk-decaffeinate convert
npx bulk-decaffeinate clean

git mv app/coffee app/js
git commit -m "Rename app/coffee dir to app/js"

git mv test/acceptance/coffee test/acceptance/js
git commit -m "Rename test/acceptance/coffee to test/acceptance/js"

npx prettier-eslint '*.js' --write
npx prettier-eslint 'config/*.js' --write
npx prettier-eslint 'app/js/**/*.js' --write
npx prettier-eslint 'test/acceptance/js/**/*.js' --write
git add .
git commit -m "Prettier: lint javascript files"

echo "done"