set -ex

npx bulk-decaffeinate convert --dir public/coffee

for module in modules/**/public/coffee; do
  npx bulk-decaffeinate convert --dir $module
done

npx bulk-decaffeinate clean

git mv public/coffee public/src

for module in modules/**/public; do
  if [ -e $module/coffee ]; then
    git mv $module/coffee $module/src
  fi
done

git commit -m "Rename public/coffee dir to public/src"

npx prettier-eslint 'public/src/**/*.js' --write

for module in modules/**/public/src; do
  npx prettier-eslint "$module/**/*.js" --write
done

git add .
git commit -m "Prettier: convert public/src decaffeinated files to Prettier format"

npx bulk-decaffeinate convert --dir test/unit_frontend/coffee

for module in modules/**/test/unit_frontend/coffee; do
  npx bulk-decaffeinate convert --dir $module
done

npx bulk-decaffeinate clean

git mv test/unit_frontend/coffee test/unit_frontend/src

for module in modules/**/test/unit_frontend; do
  if [ -e $module/coffee ]; then
    git mv $module/coffee $module/src
  fi
done

git commit -m "Rename test/unit_frontend/coffee to test/unit_frontend/src"

npx prettier-eslint 'test/unit_frontend/src/**/*.js' --write

for module in modules/**/test/unit_frontend/src; do
  npx prettier-eslint "$module/**/*.js" --write
done

git add .
git commit -m "Prettier: convert test/unit_frontend decaffeinated files to Prettier format"

echo "done"
