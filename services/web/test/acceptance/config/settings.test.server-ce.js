const { merge } = require('@overleaf/settings/merge')
const base = require('./settings.test.defaults')

module.exports = base.mergeWith({})

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
