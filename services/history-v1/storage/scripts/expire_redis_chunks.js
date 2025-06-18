const logger = require('@overleaf/logger')
const commandLineArgs = require('command-line-args')
const redis = require('../lib/redis')
const { scanAndProcessDueItems } = require('../lib/scan')
const { expireProject, claimExpireJob } = require('../lib/chunk_store/redis')

const rclient = redis.rclientHistory

const optionDefinitions = [{ name: 'dry-run', alias: 'd', type: Boolean }]
const options = commandLineArgs(optionDefinitions)
const DRY_RUN = options['dry-run'] || false

logger.initialize('expire-redis-chunks')

async function expireProjectAction(projectId) {
  const job = await claimExpireJob(projectId)
  await expireProject(projectId)
  if (job && job.close) {
    await job.close()
  }
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
