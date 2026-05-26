// Mirrors what services/real-time/app/js/DocumentUpdaterManager.queueChange does:
// pushes an OT update onto the doc's pending-updates list and notifies a
// dispatcher shard. This allows non-Socket.IO clients (e.g. the Claude Code
// sync daemon) to submit ops through the same code path as real users.

const Settings = require('@overleaf/settings')
const { promisifyAll } = require('@overleaf/promise-utils')
const redis = require('@overleaf/redis-wrapper')
const _ = require('lodash')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')

const rclient = redis.createClient(Settings.redis.documentupdater)
const Keys = Settings.redis.documentupdater.key_schema

const ALLOWED_KEYS = ['doc', 'op', 'v', 'dupIfSource', 'meta', 'lastV', 'hash']
const MAX_UPDATE_SIZE = Settings.maxUpdateSize || 7 * 1024 * 1024 + 64 * 1024
const SHARD_COUNT = parseInt(
  process.env.PENDING_UPDATE_LIST_SHARD_COUNT || Settings.dispatcherCount || 10,
  10
)

function pendingUpdateListKey() {
  const shard = _.random(0, SHARD_COUNT - 1)
  if (shard === 0) return 'pending-updates-list'
  return `pending-updates-list-${shard}`
}

const InjectOpsManager = {
  queueOp(projectId, docId, change, callback) {
    let update
    try {
      update = _.pick(change, ALLOWED_KEYS)
      update.doc = docId
      const json = JSON.stringify(update)
      if (json.indexOf('\0') !== -1) {
        return callback(new OError('null byte in injected op'))
      }
      if (json.length > MAX_UPDATE_SIZE) {
        return callback(new OError('injected op too large'))
      }

      Metrics.summary('redis.pendingUpdates', json.length, {
        status: 'inject',
      })

      rclient.rpush(
        Keys.pendingUpdates({ doc_id: docId }),
        json,
        function (err) {
          if (err) return callback(OError.tag(err, 'rpush pendingUpdates'))
          const docKey = `${projectId}:${docId}`
          const queueKey = pendingUpdateListKey()
          rclient.rpush(queueKey, docKey, function (err) {
            if (err) {
              return callback(
                OError.tag(err, 'rpush pending-updates-list', { queueKey })
              )
            }
            logger.debug(
              { projectId, docId, source: update.meta && update.meta.source },
              'injected op queued'
            )
            callback()
          })
        }
      )
    } catch (err) {
      callback(err)
    }
  },
}

module.exports = InjectOpsManager
module.exports.promises = promisifyAll(InjectOpsManager)
