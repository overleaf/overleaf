npx jscodeshift \
  -t transform.js \
  --ignore-pattern=frontend/js/libraries.js \
  --ignore-pattern=frontend/js/vendor \
  frontend/js

npx jscodeshift \
  -t transform.js \
  --ignore-pattern=test/frontend/import_tests.js \
  test/frontend

for MODULE in admin-panel cms dropbox git-bridge github-sync launchpad metrics open-in-overleaf overleaf-integration portals references-search support templates tpr-webmodule v2-templates two-factor-authentication
do
  npx jscodeshift \
  -t transform.js \
  modules/$MODULE/frontend/js
done

npx jscodeshift \
  -t transform.js \
  --ignore-pattern=modules/rich-text/frontend/js/ide/controllers/editor_loader_controller.js \
  modules/rich-text/frontend/js

npx jscodeshift \
  -t transform.js \
  modules/rich-text/test/frontend

npx jscodeshift \
  -t transform.js \
  --ignore-pattern=modules/publish-modal/frontend/js/ide/controllers/PublishController.js \
  modules/publish-modal/frontend/js

npx jscodeshift \
  -t transform.js \
  modules/publish-modal/test/frontend

make format_fix