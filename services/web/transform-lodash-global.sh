npx jscodeshift \
  -t https://gist.githack.com/40thieves/0b495af3fb0ad5fe08915ce5159a2b7b/raw/9c583c0a5b0cbd83a66538a07591b41332efda6a/transform-lodash.js \
  --ignore-pattern frontend/js/vendor \
  --noSemi=true \
  frontend/js

npx jscodeshift \
  -t https://gist.githack.com/40thieves/0b495af3fb0ad5fe08915ce5159a2b7b/raw/9c583c0a5b0cbd83a66538a07591b41332efda6a/transform-lodash.js \
  --noSemi=true \
  test/frontend

for MODULE in admin-panel cms dropbox git-bridge github-sync launchpad metrics open-in-overleaf overleaf-integration portals references-search support templates tpr-webmodule two-factor-authentication v2-templates	
do	
  npx jscodeshift \
    -t https://gist.githack.com/40thieves/0b495af3fb0ad5fe08915ce5159a2b7b/raw/9c583c0a5b0cbd83a66538a07591b41332efda6a/transform-lodash.js \
    --noSemi=true \
  modules/$MODULE/frontend/js
done

npx jscodeshift \
  -t https://gist.githack.com/40thieves/0b495af3fb0ad5fe08915ce5159a2b7b/raw/9c583c0a5b0cbd83a66538a07591b41332efda6a/transform-lodash.js \
  --noSemi=true \
  modules/rich-text/frontend/js

npx jscodeshift \
  -t https://gist.githack.com/40thieves/0b495af3fb0ad5fe08915ce5159a2b7b/raw/9c583c0a5b0cbd83a66538a07591b41332efda6a/transform-lodash.js \
  --noSemi=true \
  modules/rich-text/test/frontend

npx jscodeshift \
  -t https://gist.githack.com/40thieves/0b495af3fb0ad5fe08915ce5159a2b7b/raw/9c583c0a5b0cbd83a66538a07591b41332efda6a/transform-lodash.js \
  --noSemi=true \
  modules/publish-modal/frontend/js

npx jscodeshift \
  -t https://gist.githack.com/40thieves/0b495af3fb0ad5fe08915ce5159a2b7b/raw/9c583c0a5b0cbd83a66538a07591b41332efda6a/transform-lodash.js \
  --noSemi=true \
  modules/publish-modal/test/frontend

make format_fix