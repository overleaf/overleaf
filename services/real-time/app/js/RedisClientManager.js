import redis from '@overleaf/redis-wrapper'
import logger from '@overleaf/logger'

export default {
  createClientList(...configs) {
    // create a dynamic list of redis clients, excluding any configurations which are not defined
    return configs.filter(Boolean).map(x => {
      const redisType = x.cluster
        ? 'cluster'
        : x.sentinels
          ? 'sentinel'
          : x.host
            ? 'single'
            : 'unknown'
      logger.debug({ redis: redisType }, 'creating redis client')
      return redis.createClient(x)
    })
  },
}
