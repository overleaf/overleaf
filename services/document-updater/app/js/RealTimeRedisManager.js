/* eslint-disable
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
const Settings = require('@overleaf/settings')
const { promisifyAll } = require('@overleaf/promise-utils')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const pubsubClient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.pubsub
)
const Keys = Settings.redis.documentupdater.key_schema
const logger = require('@overleaf/logger')
const os = require('node:os')
const crypto = require('node:crypto')
const metrics = require('./Metrics')

const HOST = os.hostname()
const RND = crypto.randomBytes(4).toString('hex') // generate a random key for this process
let COUNT = 0

const MAX_OPS_PER_ITERATION = 8 // process a limited number of ops for safety

const RealTimeRedisManager = {
  getPendingUpdatesForDoc(docId, callback) {
    // Make sure that this MULTI operation only operates on doc
    // specific keys, i.e. keys that have the doc id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    const multi = rclient.multi()
    multi.llen(Keys.pendingUpdates({ doc_id: docId }))
    multi.lrange(
      Keys.pendingUpdates({ doc_id: docId }),
      0,
      MAX_OPS_PER_ITERATION - 1
    )
    multi.ltrim(
      Keys.pendingUpdates({ doc_id: docId }),
      MAX_OPS_PER_ITERATION,
      -1
    )
    multi.exec(function (error, replys) {
      if (error != null) {
        return callback(error)
      }
      const [llen, jsonUpdates, _trimResult] = replys
      metrics.histogram(
        'redis.pendingUpdates.llen',
        llen,
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100]
      )
      for (const jsonUpdate of jsonUpdates) {
        // record metric for each update removed from queue
        metrics.summary('redis.pendingUpdates', jsonUpdate.length, {
          status: 'pop',
        })
      }
      const updates = []
      for (const jsonUpdate of jsonUpdates) {
        let update
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

  getUpdatesLength(docId, callback) {
    rclient.llen(Keys.pendingUpdates({ doc_id: docId }), callback)
  },

  sendCanaryAppliedOp({ projectId, docId, op }) {
    const ack = JSON.stringify({ v: op.v, doc: docId }).length
    // Updates with op.dup===true will not get sent to other clients, they only get acked.
    const broadcast = op.dup ? 0 : JSON.stringify(op).length

    const payload = JSON.stringify({
      message: 'canary-applied-op',
      payload: {
        ack,
        broadcast,
        docId,
        projectId,
        source: op.meta.source,
      },
    })

    // Publish on the editor-events channel of the project as real-time already listens to that before completing the connection startup.

    // publish on separate channels for individual projects and docs when
    // configured (needs realtime to be configured for this too).
    if (Settings.publishOnIndividualChannels) {
      return pubsubClient.publish(`editor-events:${projectId}`, payload)
    } else {
      return pubsubClient.publish('editor-events', payload)
    }
  },

  sendData(data) {
    // create a unique message id using a counter
    const messageId = `doc:${HOST}:${RND}-${COUNT++}`
    if (data != null) {
      data._id = messageId
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

module.exports = RealTimeRedisManager
module.exports.promises = promisifyAll(RealTimeRedisManager, {
  without: ['sendCanaryAppliedOp', 'sendData'],
})
