const logger = require('@overleaf/logger')
const commandLineArgs = require('command-line-args')
const redis = require('../lib/redis')
const knex = require('../lib/knex.js')
const knexReadOnly = require('../lib/knex_read_only.js')
const { client } = require('../lib/mongodb.js')
const { scanAndProcessDueItems } = require('../lib/scan')
const { persistBuffer } = require('../lib/persist_buffer')
const { claimPersistJob } = require('../lib/chunk_store/redis')

const rclient = redis.rclientHistory

const optionDefinitions = [{ name: 'dry-run', alias: 'd', type: Boolean }]
const options = commandLineArgs(optionDefinitions)
const DRY_RUN = options['dry-run'] || false

logger.initialize('persist-redis-chunks')

async function persistProjectAction(projectId) {
  const job = await claimPersistJob(projectId)
  await persistBuffer(projectId)
  if (job && job.close) {
    await job.close()
  }
}

async function runPersistChunks() {
  await scanAndProcessDueItems(
    rclient,
    'persistChunks',
    'persist-time',
    persistProjectAction,
    DRY_RUN
  )
}

if (require.main === module) {
  runPersistChunks()
    .catch(err => {
      logger.fatal(
        { err, taskName: 'persistChunks' },
        'Unhandled error in runPersistChunks'
      )
      process.exit(1)
    })
    .finally(async () => {
      await redis.disconnect()
      await client.close()
      await knex.destroy()
      await knexReadOnly.destroy()
    })
} else {
  module.exports = {
    runPersistChunks,
  }
}
