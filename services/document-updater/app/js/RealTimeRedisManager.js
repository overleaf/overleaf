/* eslint-disable
    camelcase,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RealTimeRedisManager
const Settings = require('@overleaf/settings')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const pubsubClient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.pubsub
)
const Keys = Settings.redis.documentupdater.key_schema
const logger = require('logger-sharelatex')
const os = require('os')
const crypto = require('crypto')
const metrics = require('./Metrics')

const HOST = os.hostname()
const RND = crypto.randomBytes(4).toString('hex') // generate a random key for this process
let COUNT = 0

const MAX_OPS_PER_ITERATION = 8 // process a limited number of ops for safety

module.exports = RealTimeRedisManager = {
  getPendingUpdatesForDoc(doc_id, callback) {
    const multi = rclient.multi()
    multi.lrange(Keys.pendingUpdates({ doc_id }), 0, MAX_OPS_PER_ITERATION - 1)
    multi.ltrim(Keys.pendingUpdates({ doc_id }), MAX_OPS_PER_ITERATION, -1)
    return multi.exec(function (error, replys) {
      let jsonUpdate
      if (error != null) {
        return callback(error)
      }
      const jsonUpdates = replys[0]
      for (jsonUpdate of Array.from(jsonUpdates)) {
        // record metric for each update removed from queue
        metrics.summary('redis.pendingUpdates', jsonUpdate.length, {
          status: 'pop',
        })
      }
      const updates = []
      for (jsonUpdate of Array.from(jsonUpdates)) {
        var update
        try {
          update = JSON.parse(jsonUpdate)
        } catch (e) {
          return callback(e)
        }
        updates.push(update)
      }
      return callback(error, updates)
    })
  },

  getUpdatesLength(doc_id, callback) {
    return rclient.llen(Keys.pendingUpdates({ doc_id }), callback)
  },

  sendData(data) {
    // create a unique message id using a counter
    const message_id = `doc:${HOST}:${RND}-${COUNT++}`
    if (data != null) {
      data._id = message_id
    }

    const blob = JSON.stringify(data)
    metrics.summary('redis.publish.applied-ops', blob.length)

    // publish on separate channels for individual projects and docs when
    // configured (needs realtime to be configured for this too).
    if (Settings.publishOnIndividualChannels) {
      return pubsubClient.publish(`applied-ops:${data.doc_id}`, blob)
    } else {
      return pubsubClient.publish('applied-ops', blob)
    }
  },
}
