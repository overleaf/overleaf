const Metrics = require('@overleaf/metrics')
const SplitTestManager = require('./SplitTestManager')
const { CacheLoader } = require('cache-flow')

class SplitTestCache extends CacheLoader {
  constructor() {
    super('split-test', {
      expirationTime: 60, // 1min in seconds
    })
  }

  async load(name) {
    Metrics.inc('split_test_get_split_test_from_mongo', 1, {
      path: name,
    })
    const splitTest = await SplitTestManager.getSplitTest({
      name,
      archived: { $ne: true },
    })
    return splitTest?.toObject()
  }

  serialize(value) {
    return value
  }

  deserialize(value) {
    return value
  }
}

module.exports = new SplitTestCache()
