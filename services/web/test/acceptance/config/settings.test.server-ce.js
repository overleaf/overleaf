const { merge } = require('@overleaf/settings/merge')
const ServerCEDefaults = require('../../../config/settings.defaults')
const base = require('./settings.test.defaults')

module.exports = base.mergeWith({
  defaultFeatures: ServerCEDefaults.defaultFeatures,
  activeUserMetricInterval: 100,

  splitTestOverrides: {
    'sharing-updates-new-link': 'enabled', // routes in acceptance tests
  },
})

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
