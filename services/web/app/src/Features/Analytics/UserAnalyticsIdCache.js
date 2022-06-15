const UserGetter = require('../User/UserGetter')
const { CacheLoader } = require('cache-flow')
const { getAnalyticsIdFromMongoUser } = require('./AnalyticsHelper')

class UserAnalyticsIdCache extends CacheLoader {
  constructor() {
    super('user-analytics-id', {
      expirationTime: 60,
      maxSize: 10000,
    })
  }

  async load(userId) {
    const user = await UserGetter.promises.getUser(userId, { analyticsId: 1 })
    if (user) {
      return getAnalyticsIdFromMongoUser(user)
    }
  }

  keyToString(userId) {
    if (userId) {
      return userId.toString()
    }
  }
}

module.exports = new UserAnalyticsIdCache()
