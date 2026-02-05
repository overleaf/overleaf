import { SystemMessage } from '../../models/SystemMessage.mjs'
import { addRequiredCleanupHandlerBeforeDrainingConnections } from '../../infrastructure/GracefulShutdown.mjs'
import { callbackifyAll } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'

const PUB_SUB_CHANNEL_TRIGGER_REFRESH = 'refresh-system-messages'

const SystemMessageManager = {
  _cachedMessages: [],

  getMessages() {
    return this._cachedMessages
  },

  async getMessagesFromDB() {
    return await SystemMessage.find({}).exec()
  },

  async clearMessages() {
    await SystemMessage.deleteMany({}).exec()
    await SystemMessageManager.notifyOtherPods()
    await this.refreshCache()
  },

  async createMessage(content) {
    const message = new SystemMessage({ content })
    await message.save()
    await SystemMessageManager.notifyOtherPods()
    await this.refreshCache()
  },

  async notifyOtherPods() {
    if (!Settings.notifyOnSystemMessageChanges) return
    const redisFeatureSettings = Settings.redis.pubsub || Settings.redis.web
    const rclient = redis.createClient(redisFeatureSettings)
    try {
      await rclient.publish(PUB_SUB_CHANNEL_TRIGGER_REFRESH, '')
    } finally {
      try {
        await rclient.disconnect()
      } catch (err) {
        logger.err({ err }, 'failed to disconnect pub/sub redis client')
      }
    }
  },

  async refreshCache() {
    this._cachedMessages = await this.getMessagesFromDB()
  },

  refreshCacheInBackground() {
    this.refreshCache().catch(err => {
      logger.warn({ err }, 'failed to refresh system messages cache')
    })
  },
}

const CACHE_TIMEOUT = 10 * 1000 * (Math.random() + 2) // 20-30 seconds
SystemMessageManager.refreshCacheInBackground()
const intervalHandle = setInterval(
  () => SystemMessageManager.refreshCacheInBackground(),
  CACHE_TIMEOUT
)

addRequiredCleanupHandlerBeforeDrainingConnections(
  'update system messages',
  () => {
    clearInterval(intervalHandle)
  }
)

if (Settings.notifyOnSystemMessageChanges) {
  const pubSubClient = RedisWrapper.client('pubsub')
  pubSubClient.subscribe(PUB_SUB_CHANNEL_TRIGGER_REFRESH).catch(err => {
    logger.error(
      { err },
      'falling back to background refresh for system messages'
    )
  })
  pubSubClient.on('message', () =>
    SystemMessageManager.refreshCacheInBackground()
  )
  addRequiredCleanupHandlerBeforeDrainingConnections(
    `pub-sub ${PUB_SUB_CHANNEL_TRIGGER_REFRESH}`,
    () => pubSubClient.unsubscribe(PUB_SUB_CHANNEL_TRIGGER_REFRESH)
  )
}

export default {
  getMessages: SystemMessageManager.getMessages.bind(SystemMessageManager),
  ...callbackifyAll(SystemMessageManager, { without: ['getMessages'] }),
  promises: SystemMessageManager,
}
