/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
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
let BetaProgramHandler
const { User } = require('../../models/User')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

module.exports = BetaProgramHandler = {
  optIn(user_id, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    return User.findById(user_id, function(err, user) {
      if (err) {
        logger.warn({ err, user_id }, 'problem adding user to beta')
        return callback(err)
      }
      metrics.inc('beta-program.opt-in')
      user.betaProgram = true
      return user.save(function(err) {
        if (err) {
          logger.warn({ err, user_id }, 'problem adding user to beta')
          return callback(err)
        }
        return callback(null)
      })
    })
  },

  optOut(user_id, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    return User.findById(user_id, function(err, user) {
      if (err) {
        logger.warn({ err, user_id }, 'problem removing user from beta')
        return callback(err)
      }
      metrics.inc('beta-program.opt-out')
      user.betaProgram = false
      return user.save(function(err) {
        if (err) {
          logger.warn({ err, user_id }, 'problem removing user from beta')
          return callback(err)
        }
        return callback(null)
      })
    })
  }
}
