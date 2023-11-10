/* eslint-disable no-console */
// silence settings module
console.log = function () {}
const Settings = require('@overleaf/settings')

const MODULES = Settings.moduleImportSequence
const TARGET = process.argv.slice(2).pop() || 'test_acceptance'

if (TARGET === '--name-only') {
  console.debug(MODULES.join('\n'))
} else {
  console.debug(MODULES.map(name => `modules/${name}/${TARGET}`).join('\n'))
}
