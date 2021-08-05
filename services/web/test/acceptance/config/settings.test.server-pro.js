const { merge } = require('@overleaf/settings/merge')
const baseApp = require('../../../config/settings.overrides.server-pro')
const baseTest = require('./settings.test.defaults')

module.exports = baseApp.mergeWith(baseTest.mergeWith({}))

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
