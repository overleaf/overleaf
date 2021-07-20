const { merge } = require('@overleaf/settings/merge')

module.exports = {
  test: {
    counterInit: 0,
  },
}

module.exports.mergeWith = function (overrides) {
  return merge(overrides, module.exports)
}
