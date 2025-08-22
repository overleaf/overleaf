// @ts-check

const config = require('config')
const redis = require('@overleaf/redis-wrapper')

const historyRedisOptions = config.get('redis.history')
const rclientHistory = redis.createClient(historyRedisOptions)

const lockRedisOptions = config.get('redis.history')
const rclientLock = redis.createClient(lockRedisOptions)

async function disconnect() {
  await Promise.all([rclientHistory.disconnect(), rclientLock.disconnect()])
}

async function cleanupTestRedis() {
  await redis.cleanupTestRedis(rclientHistory)
}

module.exports = {
  rclientHistory,
  rclientLock,
  redis,
  disconnect,
  cleanupTestRedis,
}
