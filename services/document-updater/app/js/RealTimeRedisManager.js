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
 * Drain a batch of updates from a pending-updates list.
 *
 * The MULTI only operates on the single passed key (which has an id in curly
 * braces), so all of its operations run on the same node in a cluster
 * environment.
 *
 * @param {string} key - the redis key of the queue
 * @param {function(Error, Array<Object>=): void} callback
 */
function getPendingUpdatesFromQueue(key, callback) {
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
      { path: 'project' }
    )
    for (const jsonUpdate of jsonUpdates) {
      // record metric for each update removed from queue
      metrics.summary('redis.pendingUpdates', jsonUpdate.length, {
        status: 'pop',
        path: 'project',
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
   * Publish an applied op or an error for a doc back to real-time.
   *
   * The message is published on the project's editor-events channel, which
   * real-time subscribes to for the lifetime of every connected project. It is
   * broadcast to the project room in real-time; clients filter by doc id.
   *
   * @param {Object} data
   * @param {string} data.project_id - routes the message to the project's
   *        editor-events channel and to the project room in real-time
   * @param {string} data.doc_id - identifies the doc for clients
   * @param {Object} [data.op] - the applied op
   * @param {string} [data.error] - the error message when applying failed
   */
  sendData(data) {
    // create a unique message id using a counter
    const messageId = `doc:${HOST}:${RND}-${COUNT++}`
    data._id = messageId

    // the message name routes the message to the applied-ops handling in
    // real-time's editor-events processing
    data.message = data.op ? 'otUpdateApplied' : 'otUpdateError'

    const blob = JSON.stringify(data)
    metrics.summary('redis.publish.applied-ops', blob.length, {
      path: 'editor-events',
    })

    // publish on a per-project channel when configured (needs realtime to be
    // configured for this too), otherwise on the base editor-events channel.
    if (Settings.publishOnIndividualChannels) {
      return pubsubClient.publish(`editor-events:${data.project_id}`, blob)
    } else {
      return pubsubClient.publish('editor-events', blob)
    }
  },
}

module.exports = RealTimeRedisManager
module.exports.promises = promisifyAll(RealTimeRedisManager, {
  without: ['sendData'],
})
