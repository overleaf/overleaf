const logger = require('@overleaf/logger')
const commandLineArgs = require('command-line-args')
const redis = require('../lib/redis')
const { scanAndProcessDueItems } = require('../lib/scan')
const { expireProject, claimExpireJob } = require('../lib/chunk_store/redis')
const config = require('config')
const { fetchNothing } = require('@overleaf/fetch-utils')

const rclient = redis.rclientHistory

const optionDefinitions = [
  { name: 'dry-run', alias: 'd', type: Boolean },
  { name: 'post-request', type: Boolean },
]
const options = commandLineArgs(optionDefinitions)
const DRY_RUN = options['dry-run'] || false
const POST_REQUEST = options['post-request'] || false
const HISTORY_V1_URL = `http://${process.env.HISTORY_V1_HOST || 'localhost'}:${process.env.PORT || 3100}`

logger.initialize('expire-redis-chunks')

async function expireProjectAction(projectId) {
  const job = await claimExpireJob(projectId)
  if (POST_REQUEST) {
    await requestProjectExpiry(projectId)
  } else {
    await expireProject(projectId)
  }
  if (job && job.close) {
    await job.close()
  }
}

async function requestProjectExpiry(projectId) {
  logger.debug({ projectId }, 'sending project expire request')
  const url = `${HISTORY_V1_URL}/api/projects/${projectId}/expire`
  const credentials = Buffer.from(
    `staging:${config.get('basicHttpAuth.password')}`
  ).toString('base64')
  await fetchNothing(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })
}

async function runExpireChunks() {
  await scanAndProcessDueItems(
    rclient,
    'expireChunks',
    'expire-time',
    expireProjectAction,
    DRY_RUN
  )
}

if (require.main === module) {
  runExpireChunks()
    .catch(err => {
      logger.fatal(
        { err, taskName: 'expireChunks' },
        'Unhandled error in runExpireChunks'
      )
      process.exit(1)
    })
    .finally(async () => {
      await redis.disconnect()
    })
} else {
  module.exports = {
    runExpireChunks,
  }
}
