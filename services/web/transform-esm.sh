npx jscodeshift \
  -t node_modules/5to6-codemod/transforms/amd.js \
  --parser babylon \
  --ignore-pattern=frontend/js/vendor \
  frontend/js

npx jscodeshift \
  -t node_modules/5to6-codemod/transforms/amd.js \
  --parser babylon \
  --ignore-pattern=test/frontend/import_tests.js \
  test/frontend

for MODULE in admin-panel cms dropbox git-bridge github-sync launchpad metrics open-in-overleaf overleaf-integration portals references-search support templates tpr-webmodule two-factor-authentication v2-templates
do
  npx jscodeshift \
  -t node_modules/5to6-codemod/transforms/amd.js \
  --parser babylon \
  modules/$MODULE/frontend/js
done

npx jscodeshift \
  -t node_modules/5to6-codemod/transforms/amd.js \
  --parser babylon \
  modules/rich-text/frontend/js

npx jscodeshift \
  -t node_modules/5to6-codemod/transforms/amd.js \
  --parser babylon \
  modules/rich-text/test/frontend

npx jscodeshift \
  -t node_modules/5to6-codemod/transforms/amd.js \
  --parser babylon \
  modules/publish-modal/frontend/js

npx jscodeshift \
  -t node_modules/5to6-codemod/transforms/amd.js \
  --parser babylon \
  modules/publish-modal/test/frontend

make format_fix
