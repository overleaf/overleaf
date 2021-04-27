const crypto = require('crypto')
const { db } = require('../../infrastructure/mongodb')
const Errors = require('../Errors/Errors')
const { promisifyAll } = require('../../util/promises')

const ONE_HOUR_IN_S = 60 * 60

const OneTimeTokenHandler = {
  getNewToken(use, data, options, callback) {
    // options is optional
    if (!options) {
      options = {}
    }
    if (!callback) {
      callback = function (error, data) {}
    }
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    const expiresIn = options.expiresIn || ONE_HOUR_IN_S
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + expiresIn * 1000)
    const token = crypto.randomBytes(32).toString('hex')
    db.tokens.insertOne(
      {
        use,
        token,
        data,
        createdAt,
        expiresAt,
      },
      function (error) {
        if (error) {
          return callback(error)
        }
        callback(null, token)
      }
    )
  },

  getValueFromTokenAndExpire(use, token, callback) {
    if (!callback) {
      callback = function (error, data) {}
    }
    const now = new Date()
    db.tokens.findOneAndUpdate(
      {
        use,
        token,
        expiresAt: { $gt: now },
        usedAt: { $exists: false },
      },
      {
        $set: {
          usedAt: now,
        },
      },
      function (error, result) {
        if (error) {
          return callback(error)
        }
        const token = result.value
        if (!token) {
          return callback(new Errors.NotFoundError('no token found'))
        }
        callback(null, token.data)
      }
    )
  },
}

OneTimeTokenHandler.promises = promisifyAll(OneTimeTokenHandler)

module.exports = OneTimeTokenHandler
