import UserGetter from '../User/UserGetter.mjs'
import { CacheLoader } from 'cache-flow'
import Metrics from '@overleaf/metrics'

class UserAnalyticsDataCache extends CacheLoader {
  constructor() {
    super('user-analytics-id', {
      expirationTime: 60,
      maxSize: 10000,
    })
  }

  async load(userId) {
    const user = await UserGetter.promises.getUser(userId, {
      analyticsId: 1,
      labsProgram: 1,
    })
    if (user) {
      return {
        analyticsId: user.analyticsId || user._id.toString(),
        labsProgram: user.labsProgram,
      }
    }
  }

  keyToString(userId) {
    if (userId) {
      return userId.toString()
    }
  }

  get() {
    throw new Error('use UserAnalyticsDataCache.getWithMetrics')
  }

  async getWithMetrics(userId, path) {
    const { value, cached } = await this.getWithMetadata(userId)
    Metrics.inc('user_analytics_id_cache', 1, {
      status: cached ? 'hit' : 'miss',
      path,
    })
    return value
  }

  async getIsLabsUserWithMetrics(userId, path) {
    const { value, cached } = await this.getWithMetadata(userId)
    Metrics.inc('user_analytics_id_cache', 1, {
      status: cached ? 'hit' : 'miss',
      path,
    })
    return value?.labsProgram
  }
}

const userAnalyticsDataCache = new UserAnalyticsDataCache()
export default {
  async getAnalyticsId(userId, path) {
    const value = await userAnalyticsDataCache.getWithMetrics(userId, path)
    return value?.analyticsId
  },
  async getAnalyticsData(userId, path) {
    const data = await userAnalyticsDataCache.getWithMetrics(userId, path)
    if (!data) {
      return {}
    }
    return data
  },
  async reset() {
    await userAnalyticsDataCache.reset()
  },
  async invalidateCache(userId) {
    await userAnalyticsDataCache.delete(userId)
  },
}
