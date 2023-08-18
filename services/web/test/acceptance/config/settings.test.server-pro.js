const { merge } = require('@overleaf/settings/merge')
const baseApp = require('../../../config/settings.overrides.server-pro')
const baseTestServerCE = require('./settings.test.server-ce')

module.exports = baseApp.mergeWith(
  baseTestServerCE.mergeWith({
    proxyLearn: true,
  })
)

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
