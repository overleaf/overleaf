/* eslint-disable
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
const Settings = require('settings-sharelatex')
const crypto = require('crypto')
const logger = require('logger-sharelatex')
const { db } = require('../../infrastructure/mongojs')
const Errors = require('../Errors/Errors')

const ONE_HOUR_IN_S = 60 * 60

module.exports = {
  getNewToken(use, data, options, callback) {
    // options is optional
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function(error, data) {}
    }
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    const expiresIn = options.expiresIn || ONE_HOUR_IN_S
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + expiresIn * 1000)
    const token = crypto.randomBytes(32).toString('hex')
    logger.log(
      { data, expiresIn, token_start: token.slice(0, 8) },
      `generating token for ${use}`
    )
    return db.tokens.insert(
      {
        use,
        token,
        data,
        createdAt,
        expiresAt
      },
      function(error) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, token)
      }
    )
  },

  getValueFromTokenAndExpire(use, token, callback) {
    if (callback == null) {
      callback = function(error, data) {}
    }
    logger.log(
      { token_start: token.slice(0, 8) },
      `getting data from ${use} token`
    )
    const now = new Date()
    return db.tokens.findAndModify(
      {
        query: {
          use,
          token,
          expiresAt: { $gt: now },
          usedAt: { $exists: false }
        },
        update: {
          $set: {
            usedAt: now
          }
        }
      },
      function(error, token) {
        if (error != null) {
          return callback(error)
        }
        if (token == null) {
          return callback(new Errors.NotFoundError('no token found'))
        }
        return callback(null, token.data)
      }
    )
  }
}
