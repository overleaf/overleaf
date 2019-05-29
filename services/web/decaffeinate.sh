#!/usr/local/bin/zsh
set -ex

echo "----------------------------------------"
echo "-------GIT CLEANING UNUSED FILES--------"
echo "----------------------------------------"

git clean -fd

echo "----------------------------------------"
echo "--------------ENTRY FILE----------------"
echo "----------------------------------------"

npx bulk-decaffeinate convert --file app.coffee

for entryPoint in modules/**/index.coffee; do
  npx bulk-decaffeinate convert --file $entryPoint
done

npx bulk-decaffeinate clean

npx prettier-eslint 'app.js' --write

for entryPoint in modules/**/index.js; do
  npx prettier-eslint "$entryPoint" --write
done

git add .
git commit -m "Prettier: convert app.js & index.js decaffeinated files to Prettier format"

echo "----------------------------------------"
echo "------------GRUNTFILE FILE--------------"
echo "----------------------------------------"

npx bulk-decaffeinate convert --file Gruntfile.coffee

npx bulk-decaffeinate clean

npx prettier-eslint 'Gruntfile.js' --write

git add .
git commit -m "Prettier: convert Gruntfile.coffee decaffeinated files to Prettier format"

echo "----------------------------------------"
echo "------------------APP-------------------"
echo "----------------------------------------"

npx bulk-decaffeinate convert --dir app/coffee

for module in modules/**/app/coffee; do
  npx bulk-decaffeinate convert --dir $module
done

npx bulk-decaffeinate clean

git mv app/coffee app/src

for module in modules/**/app; do
  if [ -e $module/coffee ]; then
    git mv $module/coffee $module/src
  fi
done

git commit -m "Rename app/coffee dir to app/src"

npx prettier-eslint 'app/src/**/*.js' --write

for module in modules/**/app/src; do
  npx prettier-eslint "$module/**/*.js" --write
done

git add .
git commit -m "Prettier: convert app/src decaffeinated files to Prettier format"

echo "----------------------------------------"
echo "--------------UNIT TESTS----------------"
echo "----------------------------------------"

npx bulk-decaffeinate convert --dir test/unit/coffee

for module in modules/**/test/unit/coffee; do
  npx bulk-decaffeinate convert --dir $module
done

npx bulk-decaffeinate clean

git mv test/unit/coffee test/unit/src

for module in modules/**/test/unit; do
  if [ -e $module/coffee ]; then
    git mv $module/coffee $module/src
  fi
done

git commit -m "Rename test/unit/coffee to test/unit/src"

npx prettier-eslint 'test/unit/src/**/*.js' --write

for module in modules/**/test/unit/src; do
  npx prettier-eslint "$module/**/*.js" --write
done

git add .
git commit -m "Prettier: convert test/unit decaffeinated files to Prettier format"

echo "----------------------------------------"
echo "-----------ACCEPTANCE TESTS-------------"
echo "----------------------------------------"

npx bulk-decaffeinate convert --dir test/acceptance/coffee

for module in modules/**/test/acceptance/coffee; do
  npx bulk-decaffeinate convert --dir $module
done

npx bulk-decaffeinate clean

git mv test/acceptance/coffee test/acceptance/src

for module in modules/**/test/acceptance; do
  if [ -e $module/coffee ]; then
    git mv $module/coffee $module/src
  fi
done

git commit -m "Rename test/acceptance/coffee to test/acceptance/src"

npx prettier-eslint 'test/acceptance/src/**/*.js' --write

for module in modules/**/test/acceptance/src; do
  npx prettier-eslint "$module/**/*.js" --write
done

git add .
git commit -m "Prettier: convert test/acceptance decaffeinated files to Prettier format"

echo "----------------------------------------"
echo "-------------SMOKE TESTS----------------"
echo "----------------------------------------"

npx bulk-decaffeinate convert --dir test/smoke/coffee

npx bulk-decaffeinate clean

git mv test/smoke/coffee test/smoke/src

git commit -m "Rename test/smoke/coffee to test/smoke/src"

npx prettier-eslint 'test/smoke/src/**/*.js' --write

git add .
git commit -m "Prettier: convert test/smoke decaffeinated files to Prettier format"

echo "----------------------------------------"
echo "-----------FIX REQUIRE PATHS------------"
echo "----------------------------------------"

perl -i.bak -pe "s/([\'\"\`].*)\/app\/js(.*[\'\"\`])/\1\/app\/src\2/g" app.js
rm app.js.bak

perl -i.bak -pe "s/([\'\"\`].*)\/app\/js(.*[\'\"\`])/\1\/app\/src\2/g" Gruntfile.js
rm Gruntfile.js.bak

perl -i.bak -pe "s/([\'\"\`].*)\/app\/js(.*[\'\"\`])/\1\/app\/src\2/g" modules/**/index.js
rm modules/**/index.js.bak

perl -i.bak -pe "s/([\'\"\`].*)\/app\/js(.*[\'\"\`])/\1\/app\/src\2/g" **/src/**/*.js
rm **/src/**/*.js.bak

perl -i.bak -pe "s/([\'\"\`].*)\/test\/acceptance\/js(.*[\'\"\`])/\1\/test\/acceptance\/src\2/g" **/src/**/*.js
rm **/src/**/*.js.bak

perl -i.bak -pe "s/([\'\"\`].*)test\/smoke\/js(.*[\'\"\`])/\1test\/smoke\/src\2/g" **/src/**/*.js
rm **/src/**/*.js.bak

# Fix formatting after rewriting paths - extra character can make a difference
make format_fix

git add .
git commit -m "Fix require paths in modules after decaffeination" || true

echo "done"
