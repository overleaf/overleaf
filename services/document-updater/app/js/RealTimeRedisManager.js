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

/**
 * Shared implementation for draining a batch of updates from a
 * pending-updates list. Used for both the per-doc and per-project queues;
 * `path` ('doc' | 'project') differentiates the two in metrics.
 *
 * The MULTI only operates on the single passed key (which has an id in curly
 * braces), so all of its operations run on the same node in a cluster
 * environment.
 *
 * @param {string} key - the redis key of the queue
 * @param {'doc' | 'project'} path - metrics label
 * @param {function(Error, Array<Object>=): void} callback
 */
function getPendingUpdatesFromQueue(key, path, callback) {
  const multi = rclient.multi()
  multi.llen(key)
  multi.lrange(key, 0, MAX_OPS_PER_ITERATION - 1)
  multi.ltrim(key, MAX_OPS_PER_ITERATION, -1)
  multi.exec(function (error, replys) {
    if (error != null) {
      return callback(error)
    }
    const [llen, jsonUpdates, _trimResult] = replys
    metrics.histogram(
      'redis.pendingUpdates.llen',
      llen,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100],
      { path }
    )
    for (const jsonUpdate of jsonUpdates) {
      // record metric for each update removed from queue
      metrics.summary('redis.pendingUpdates', jsonUpdate.length, {
        status: 'pop',
        path,
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
}

const RealTimeRedisManager = {
  /**
   * Drain a batch of updates from a doc's legacy per-doc queue.
   *
   * @param {string} docId
   * @param {function(Error, Array<Object>=): void} callback
   */
  getPendingUpdatesForDoc(docId, callback) {
    getPendingUpdatesFromQueue(
      Keys.pendingUpdates({ doc_id: docId }),
      'doc',
      callback
    )
  },

  /**
   * Get the length of a doc's legacy per-doc queue.
   *
   * @param {string} docId
   * @param {function(Error, number=): void} callback
   */
  getUpdatesLength(docId, callback) {
    rclient.llen(Keys.pendingUpdates({ doc_id: docId }), callback)
  },

  /**
   * Drain a batch of updates from a project's per-project queue. Each update
   * on the per-project queue carries its own `doc` id so the caller knows
   * which doc to apply it to.
   *
   * @param {string} projectId
   * @param {function(Error, Array<Object>=): void} callback
   */
  getPendingProjectUpdates(projectId, callback) {
    getPendingUpdatesFromQueue(
      Keys.pendingProjectUpdates({ project_id: projectId }),
      'project',
      callback
    )
  },

  /**
   * Get the length of a project's per-project queue.
   *
   * @param {string} projectId
   * @param {function(Error, number=): void} callback
   */
  getProjectUpdatesLength(projectId, callback) {
    rclient.llen(
      Keys.pendingProjectUpdates({ project_id: projectId }),
      callback
    )
  },

  /**
   * Publish a canary message on the project's editor-events channel with the
   * sizes of the applied op's ack and broadcast payloads.
   *
   * @param {{projectId: string, docId: string, op: Object}} args
   */
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

  /**
   * Publish an applied-ops message, stamped with a unique message id.
   *
   * @param {Object} data
   */
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
