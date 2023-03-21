/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HistoryRedisManager
const Settings = require('@overleaf/settings')
const { rclient } = require('./RedisManager') // docsWithHistoryOps lives in main redis
const Keys = Settings.redis.history.key_schema
const logger = require('@overleaf/logger')

module.exports = HistoryRedisManager = {
  recordDocHasHistoryOps(projectId, docId, ops, callback) {
    if (ops == null) {
      ops = []
    }
    if (callback == null) {
      callback = function () {}
    }
    if (ops.length === 0) {
      return callback(new Error('cannot push no ops')) // This should never be called with no ops, but protect against a redis error if we sent an empty array to rpush
    }
    logger.debug({ projectId, docId }, 'marking doc in project for history ops')
    return rclient.sadd(
      Keys.docsWithHistoryOps({ project_id: projectId }),
      docId,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        return callback()
      }
    )
  },
}
