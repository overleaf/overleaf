const base = require('../../../config/settings.overrides.server-pro')

module.exports = base.mergeWith({
  test: {
    counterInit: 0,
  },
})
