const base = require(process.env.BASE_CONFIG)

module.exports = base.mergeWith({
  enableLegacyLogin: true,
  test: {
    counterInit: 210000,
  },
})
