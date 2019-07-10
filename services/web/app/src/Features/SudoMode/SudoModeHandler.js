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
let SudoModeHandler
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('sudomode')
const logger = require('logger-sharelatex')
const AuthenticationManager = require('../Authentication/AuthenticationManager')

const TIMEOUT_IN_SECONDS = 60 * 60

module.exports = SudoModeHandler = {
  _buildKey(userId) {
    return `SudoMode:{${userId}}`
  },

  authenticate(email, password, callback) {
    if (callback == null) {
      callback = function() {}
    }
    AuthenticationManager.authenticate({ email }, password, callback)
  },

  activateSudoMode(userId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (userId == null) {
      return callback(new Error('[SudoMode] user must be supplied'))
    }
    const duration = TIMEOUT_IN_SECONDS
    logger.log({ userId, duration }, '[SudoMode] activating sudo mode for user')
    return rclient.set(
      SudoModeHandler._buildKey(userId),
      '1',
      'EX',
      duration,
      callback
    )
  },

  clearSudoMode(userId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (userId == null) {
      return callback(new Error('[SudoMode] user must be supplied'))
    }
    logger.log({ userId }, '[SudoMode] clearing sudo mode for user')
    return rclient.del(SudoModeHandler._buildKey(userId), callback)
  },

  isSudoModeActive(userId, callback) {
    if (callback == null) {
      callback = function(err, isActive) {}
    }
    if (userId == null) {
      return callback(new Error('[SudoMode] user must be supplied'))
    }
    return rclient.get(SudoModeHandler._buildKey(userId), function(
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
