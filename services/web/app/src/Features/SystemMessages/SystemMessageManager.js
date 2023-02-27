/* eslint-disable
    n/handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SystemMessageManager
const { SystemMessage } = require('../../models/SystemMessage')
const {
  addRequiredCleanupHandlerBeforeDrainingConnections,
} = require('../../infrastructure/GracefulShutdown')

module.exports = SystemMessageManager = {
  getMessages(callback) {
    if (callback == null) {
      callback = function () {}
    }
    callback(null, this._cachedMessages)
  },

  getMessagesFromDB(callback) {
    if (callback == null) {
      callback = function () {}
    }
    SystemMessage.find({}, callback)
  },

  clearMessages(callback) {
    if (callback == null) {
      callback = function () {}
    }
    SystemMessage.deleteMany({}, callback)
  },

  createMessage(content, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const message = new SystemMessage({ content })
    message.save(callback)
  },

  refreshCache() {
    this.getMessagesFromDB((error, messages) => {
      if (!error) {
        this._cachedMessages = messages
      }
    })
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
