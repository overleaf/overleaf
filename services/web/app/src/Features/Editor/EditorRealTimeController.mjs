/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let EditorRealTimeController
const Settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('pubsub')
const os = require('os')
const crypto = require('crypto')

const HOST = os.hostname()
const RND = crypto.randomBytes(4).toString('hex') // generate a random key for this process
let COUNT = 0

module.exports = EditorRealTimeController = {
  emitToRoom(roomId, message, ...payload) {
    // create a unique message id using a counter
    const messageId = `web:${HOST}:${RND}-${COUNT++}`
    let channel
    if (roomId === 'all' || !Settings.publishOnIndividualChannels) {
      channel = 'editor-events'
    } else {
      channel = `editor-events:${roomId}`
    }
    const blob = JSON.stringify({
      room_id: roomId,
      message,
      payload,
      _id: messageId,
    })
    Metrics.summary('redis.publish.editor-events', blob.length, {
      status: message,
    })
    return rclient.publish(channel, blob)
  },

  emitToAll(message, ...payload) {
    return this.emitToRoom('all', message, ...Array.from(payload))
  },
}
