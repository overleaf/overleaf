import { SystemMessage } from '../../models/SystemMessage.mjs'
import { addRequiredCleanupHandlerBeforeDrainingConnections } from '../../infrastructure/GracefulShutdown.mjs'
import { callbackifyAll } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'

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
    await this.refreshCache()
  },

  async createMessage(content) {
    const message = new SystemMessage({ content })
    await message.save()
    await this.refreshCache()
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

export default {
  getMessages: SystemMessageManager.getMessages.bind(SystemMessageManager),
  ...callbackifyAll(SystemMessageManager, { without: ['getMessages'] }),
  promises: SystemMessageManager,
}
