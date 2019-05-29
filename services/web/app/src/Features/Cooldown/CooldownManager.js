/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CooldownManager
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('cooldown')
const logger = require('logger-sharelatex')

const COOLDOWN_IN_SECONDS = 60 * 10

module.exports = CooldownManager = {
  _buildKey(projectId) {
    return `Cooldown:{${projectId}}`
  },

  putProjectOnCooldown(projectId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    logger.log(
      { projectId },
      `[Cooldown] putting project on cooldown for ${COOLDOWN_IN_SECONDS} seconds`
    )
    return rclient.set(
      CooldownManager._buildKey(projectId),
      '1',
      'EX',
      COOLDOWN_IN_SECONDS,
      callback
    )
  },

  isProjectOnCooldown(projectId, callback) {
    if (callback == null) {
      callback = function(err, isOnCooldown) {}
    }
    return rclient.get(CooldownManager._buildKey(projectId), function(
      err,
      result
    ) {
      if (err != null) {
        return callback(err)
      }
      return callback(null, result === '1')
    })
  }
}
