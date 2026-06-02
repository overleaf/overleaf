const pkg = require('./package.json')

module.exports = {
  meta: {
    name: pkg.name,
    version: pkg.version,
  },
  rules: {
    'no-unnecessary-trans': require('./no-unnecessary-trans'),
    'prefer-kebab-url': require('./prefer-kebab-url'),
    'should-unescape-trans': require('./should-unescape-trans'),
    'no-generated-editor-themes': require('./no-generated-editor-themes'),
    'require-script-runner': require('./require-script-runner'),
    'require-vi-doMock-valid-path': require('./require-vi-doMock-valid-path'),
    'require-loading-label': require('./require-loading-label'),
    'require-cio-snake-case-properties': require('./require-cio-snake-case-properties'),
    'no-throw-in-callback': require('./no-throw-in-callback'),
  },
}
