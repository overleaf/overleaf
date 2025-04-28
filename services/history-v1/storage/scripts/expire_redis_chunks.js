const logger = require('@overleaf/logger')
const commandLineArgs = require('command-line-args') // Add this line
const redis = require('../lib/redis')
const { scanRedisCluster, extractKeyId } = require('../lib/scan')
const { expireCurrentChunk } = require('../lib/chunk_store/redis')

const rclient = redis.rclientHistory
const EXPIRE_TIME_KEY_PATTERN = `expire-time:{*}`

const optionDefinitions = [{ name: 'dry-run', alias: 'd', type: Boolean }]
const options = commandLineArgs(optionDefinitions)
const DRY_RUN = options['dry-run'] || false

logger.initialize('expire-redis-chunks')

function isExpiredKey(expireTimestamp, currentTime) {
  const expireTime = parseInt(expireTimestamp, 10)
  if (isNaN(expireTime)) {
    return false
  }
  logger.debug(
    {
      expireTime,
      currentTime,
      expireIn: expireTime - currentTime,
      expired: currentTime > expireTime,
    },
    'Checking if key is expired'
  )
  return currentTime > expireTime
}

async function processKeysBatch(keysBatch, rclient) {
  let clearedKeyCount = 0
  if (keysBatch.length === 0) {
    return 0
  }
  // For efficiency, we use MGET to fetch all the timestamps in a single request
  const expireTimestamps = await rclient.mget(keysBatch)
  const currentTime = Date.now()
  for (let i = 0; i < keysBatch.length; i++) {
    const key = keysBatch[i]
    // For each key, do a quick check to see if the key is expired before calling
    // the LUA script to expire the chunk atomically.
    if (isExpiredKey(expireTimestamps[i], currentTime)) {
      const projectId = extractKeyId(key)
      if (DRY_RUN) {
        logger.info({ projectId }, '[Dry Run] Would expire chunk for project')
      } else {
        await expireCurrentChunk(projectId)
      }
      clearedKeyCount++
    }
  }
  return clearedKeyCount
}

async function expireRedisChunks() {
  let scannedKeyCount = 0
  let clearedKeyCount = 0
  const START_TIME = Date.now()

  if (DRY_RUN) {
    // Use global DRY_RUN
    logger.info({}, 'starting expireRedisChunks scan in DRY RUN mode')
  } else {
    logger.info({}, 'starting expireRedisChunks scan')
  }

  for await (const keysBatch of scanRedisCluster(
    rclient,
    EXPIRE_TIME_KEY_PATTERN
  )) {
    scannedKeyCount += keysBatch.length
    clearedKeyCount += await processKeysBatch(keysBatch, rclient)
    if (scannedKeyCount % 1000 === 0) {
      logger.info(
        { scannedKeyCount, clearedKeyCount },
        'expireRedisChunks scan progress'
      )
    }
  }
  logger.info(
    {
      scannedKeyCount,
      clearedKeyCount,
      elapsedTimeInSeconds: Math.floor((Date.now() - START_TIME) / 1000),
      dryRun: DRY_RUN,
    },
    'expireRedisChunks scan complete'
  )
  await redis.disconnect()
}

expireRedisChunks().catch(err => {
  logger.fatal({ err }, 'unhandled error in expireRedisChunks')
  process.exit(1)
})
