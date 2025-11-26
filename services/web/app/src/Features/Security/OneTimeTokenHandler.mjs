import crypto from 'node:crypto'
import { db } from '../../infrastructure/mongodb.mjs'
import Errors from '../Errors/Errors.js'
import { callbackify } from 'node:util'

const ONE_HOUR_IN_S = 60 * 60

async function peekValueFromToken(use, token) {
  const tokenDoc = await db.tokens.findOneAndUpdate(
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
    }
  )
  if (!tokenDoc) {
    throw new Errors.NotFoundError('no token found')
  }
  // The allowed number of peaks will be 1 less than OneTimeTokenHandler.MAX_PEEKS
  // since the updated doc is returned after findOneAndUpdate above
  const remainingPeeks = OneTimeTokenHandler.MAX_PEEKS - tokenDoc.peekCount

  return { data: tokenDoc.data, remainingPeeks }
}

async function getNewToken(use, data, options = {}) {
  const expiresIn = options.expiresIn || ONE_HOUR_IN_S
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + expiresIn * 1000)
  const token = crypto.randomBytes(32).toString('hex')

  await db.tokens.insertOne({
    use,
    token,
    data,
    createdAt,
    expiresAt,
  })

  return token
}

async function getValueFromTokenAndExpire(use, token) {
  const now = new Date()
  const tokenDoc = await db.tokens.findOneAndUpdate(
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
    }
  )

  if (!tokenDoc) {
    throw new Errors.NotFoundError('no token found')
  }

  return tokenDoc.data
}

async function expireToken(use, token) {
  const now = new Date()
  await db.tokens.updateOne(
    {
      use,
      token,
    },
    {
      $set: {
        usedAt: now,
      },
    }
  )
}

async function expireAllTokensForUser(userId, use) {
  const now = new Date()
  await db.tokens.updateMany(
    {
      use,
      'data.user_id': userId.toString(),
      usedAt: { $exists: false },
    },
    {
      $set: {
        usedAt: now,
      },
    }
  )
}

const OneTimeTokenHandler = {
  MAX_PEEKS: 4,
  getNewToken: callbackify(getNewToken),
  getValueFromTokenAndExpire: callbackify(getValueFromTokenAndExpire),
  peekValueFromToken: callbackify(peekValueFromToken),
  expireToken: callbackify(expireToken),
  expireAllTokensForUser: callbackify(expireAllTokensForUser),
  promises: {
    getNewToken,
    getValueFromTokenAndExpire,
    peekValueFromToken,
    expireToken,
    expireAllTokensForUser,
  },
}

export default OneTimeTokenHandler
