/* eslint-disable
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SystemMessageManager
const { SystemMessage } = require('../../models/SystemMessage')

module.exports = SystemMessageManager = {
  getMessages(callback) {
    if (callback == null) {
      callback = function(error, messages) {}
    }
    callback(null, this._cachedMessages)
  },

  getMessagesFromDB(callback) {
    if (callback == null) {
      callback = function(error, messages) {}
    }
    return SystemMessage.find({}, callback)
  },

  clearMessages(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return SystemMessage.remove({}, callback)
  },

  createMessage(content, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const message = new SystemMessage({ content })
    return message.save(callback)
  },

  refreshCache() {
    this.getMessagesFromDB((error, messages) => {
      if (!error) {
        this._cachedMessages = messages
      }
    })
  }
}

const CACHE_TIMEOUT = 10 * 1000 * (Math.random() + 2) // 20-30 seconds
SystemMessageManager.refreshCache()
setInterval(() => SystemMessageManager.refreshCache(), CACHE_TIMEOUT)
