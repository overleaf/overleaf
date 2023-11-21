const crypto = require('crypto')
const { db } = require('../../infrastructure/mongodb')
const Errors = require('../Errors/Errors')
const { promisifyAll } = require('@overleaf/promise-utils')

const ONE_HOUR_IN_S = 60 * 60

const OneTimeTokenHandler = {
  MAX_PEEKS: 4,

  getNewToken(use, data, options, callback) {
    // options is optional
    if (!options) {
      options = {}
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
    const now = new Date()
    db.tokens.findOneAndUpdate(
      {
        use,
        token,
        expiresAt: { $gt: now },
        usedAt: { $exists: false },
        peekCount: { $not: { $gte: OneTimeTokenHandler.MAX_PEEKS } },
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

  peekValueFromToken(use, token, callback) {
    db.tokens.findOneAndUpdate(
      {
        use,
        token,
        expiresAt: { $gt: new Date() },
        usedAt: { $exists: false },
        peekCount: { $not: { $gte: OneTimeTokenHandler.MAX_PEEKS } },
      },
      {
        $inc: { peekCount: 1 },
      },
      {
        returnDocument: 'after',
      },
      function (error, result) {
        if (error) {
          return callback(error)
        }
        const token = result.value
        if (!token) {
          return callback(new Errors.NotFoundError('no token found'))
        }
        const remainingPeeks = OneTimeTokenHandler.MAX_PEEKS - token.peekCount
        callback(null, token.data, remainingPeeks)
      }
    )
  },

  expireToken(use, token, callback) {
    const now = new Date()
    db.tokens.updateOne(
      {
        use,
        token,
      },
      {
        $set: {
          usedAt: now,
        },
      },
      error => {
        callback(error)
      }
    )
  },

  expireAllTokensForUser(userId, use, callback) {
    const now = new Date()
    db.tokens.updateMany(
      {
        use,
        'data.user_id': userId.toString(),
        usedAt: { $exists: false },
      },
      {
        $set: {
          usedAt: now,
        },
      },
      error => {
        callback(error)
      }
    )
  },
}

OneTimeTokenHandler.promises = promisifyAll(OneTimeTokenHandler)

module.exports = OneTimeTokenHandler
