# run tranformer
npx jscodeshift \
  -t transform/o-error/transform.js \
  --ignore-pattern=frontend/js/libraries.js \
  --ignore-pattern=frontend/js/vendor \
  "$1"
# replace blank lines in staged changed with token
git diff --ignore-all-space --ignore-blank-lines | sed 's/^\+$/\+REMOVE_ME_IM_A_BLANK_LINE/g' | git apply --reject --cached --ignore-space-change
# stage changes with token instead of blank line
git checkout .
git add -A
# delete line containing token in staged files
git diff --cached --name-only | xargs sed -i '/^REMOVE_ME_IM_A_BLANK_LINE$/d'
# fix format on modified files
make format_fix
