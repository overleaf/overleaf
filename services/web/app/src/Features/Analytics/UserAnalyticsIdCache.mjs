import UserGetter from '../User/UserGetter.mjs'
import { CacheLoader } from 'cache-flow'
import { callbackify } from 'node:util'

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
      return user.analyticsId || user._id.toString()
    }
  }

  keyToString(userId) {
    if (userId) {
      return userId.toString()
    }
  }
}

const userAnalyticsIdCache = new UserAnalyticsIdCache()
userAnalyticsIdCache.callbacks = {
  get: callbackify(userAnalyticsIdCache.get).bind(userAnalyticsIdCache),
}
export default userAnalyticsIdCache
