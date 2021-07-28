const SplitTestManager = require('./SplitTestManager')
const { SplitTest } = require('../../models/SplitTest')
const { CacheLoader } = require('cache-flow')

class SplitTestCache extends CacheLoader {
  constructor() {
    super('split-test', {
      expirationTime: 60, // 1min in seconds
    })
  }

  async load(name) {
    return await SplitTestManager.getSplitTestByName(name)
  }

  serialize(value) {
    return value.toObject()
  }

  deserialize(value) {
    return new SplitTest(value)
  }
}

module.exports = new SplitTestCache()
