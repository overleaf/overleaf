const { SystemMessage } = require('../../models/SystemMessage')
const {
  addRequiredCleanupHandlerBeforeDrainingConnections,
} = require('../../infrastructure/GracefulShutdown')
const { callbackifyAll } = require('@overleaf/promise-utils')

const SystemMessageManager = {
  getMessages() {
    return this._cachedMessages
  },

  async getMessagesFromDB() {
    return await SystemMessage.find({}).exec()
  },

  async clearMessages() {
    await SystemMessage.deleteMany({}).exec()
  },

  async createMessage(content) {
    const message = new SystemMessage({ content })
    await message.save()
  },

  async refreshCache() {
    const messages = await this.getMessagesFromDB()
    this._cachedMessages = messages
  },
}

const CACHE_TIMEOUT = 10 * 1000 * (Math.random() + 2) // 20-30 seconds
SystemMessageManager.refreshCache()
const intervalHandle = setInterval(
  () => SystemMessageManager.refreshCache(),
  CACHE_TIMEOUT
)

addRequiredCleanupHandlerBeforeDrainingConnections(
  'update system messages',
  () => {
    clearInterval(intervalHandle)
  }
)

module.exports = {
  getMessages: SystemMessageManager.getMessages.bind(SystemMessageManager),
  ...callbackifyAll(SystemMessageManager, { without: ['getMessages'] }),
  promises: SystemMessageManager,
}
