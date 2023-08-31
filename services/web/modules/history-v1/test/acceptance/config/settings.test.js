const base = require(process.env.BASE_CONFIG)

module.exports = base.mergeWith({
  test: {
    counterInit: 190000,
  },
})
