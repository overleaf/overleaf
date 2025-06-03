'use strict'

const { Snapshot } = require('overleaf-editor-core')
const redis = require('../../../../../storage/lib/redis')
const redisBackend = require('../../../../../storage/lib/chunk_store/redis')
const rclient = redis.rclientHistory
const keySchema = redisBackend.keySchema

// Helper to set up a basic project state in Redis
async function setupProjectState(
  projectId,
  {
    headVersion = 0,
    persistedVersion = null,
    expireTime = null,
    persistTime = null,
    changes = [],
    expireTimeFuture = false, // Default to not setting future expire time unless specified
  }
) {
  const headSnapshot = new Snapshot()
  await rclient.set(
    keySchema.head({ projectId }),
    JSON.stringify(headSnapshot.toRaw())
  )
  await rclient.set(
    keySchema.headVersion({ projectId }),
    headVersion.toString()
  )

  if (persistedVersion !== null) {
    await rclient.set(
      keySchema.persistedVersion({ projectId }),
      persistedVersion.toString()
    )
  } else {
    await rclient.del(keySchema.persistedVersion({ projectId }))
  }

  if (expireTime !== null) {
    await rclient.set(
      keySchema.expireTime({ projectId }),
      expireTime.toString()
    )
  } else {
    // If expireTimeFuture is true, set it to a future time, otherwise delete it if null
    if (expireTimeFuture) {
      const futureExpireTime = Date.now() + 5 * 60 * 1000 // 5 minutes in the future
      await rclient.set(
        keySchema.expireTime({ projectId }),
        futureExpireTime.toString()
      )
    } else {
      await rclient.del(keySchema.expireTime({ projectId }))
    }
  }

  if (persistTime !== null) {
    await rclient.set(
      keySchema.persistTime({ projectId }),
      persistTime.toString()
    )
  } else {
    await rclient.del(keySchema.persistTime({ projectId }))
  }

  if (changes.length > 0) {
    const rawChanges = changes.map(c => JSON.stringify(c.toRaw()))
    await rclient.rpush(keySchema.changes({ projectId }), ...rawChanges)
  } else {
    await rclient.del(keySchema.changes({ projectId }))
  }
}

module.exports = { setupProjectState, rclient, keySchema }
