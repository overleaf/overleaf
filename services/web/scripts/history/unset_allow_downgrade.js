const { promisify } = require('util')
const { ObjectId } = require('mongodb')
const {
  db,
  waitForDb,
  READ_PREFERENCE_SECONDARY,
} = require('../../app/src/infrastructure/mongodb')
const sleep = promisify(setTimeout)
const _ = require('lodash')

const NOW_IN_S = Date.now() / 1000
const ONE_WEEK_IN_S = 60 * 60 * 24 * 7
const TEN_SECONDS = 10 * 1000

function getSecondsFromObjectId(id) {
  return id.getTimestamp().getTime() / 1000
}

async function main(options) {
  if (!options) {
    options = {}
  }
  _.defaults(options, {
    projectId: process.env.PROJECT_ID,
    dryRun: process.env.DRY_RUN !== 'false',
    verboseLogging: process.env.VERBOSE_LOGGING === 'true',
    firstProjectId: process.env.FIRST_PROJECT_ID
      ? ObjectId(process.env.FIRST_PROJECT_ID)
      : ObjectId('4b3d3b3d0000000000000000'), // timestamped to 2010-01-01T00:01:01.000Z
    incrementByS: parseInt(process.env.INCREMENT_BY_S, 10) || ONE_WEEK_IN_S,
    batchSize: parseInt(process.env.BATCH_SIZE, 10) || 1000,
    stopAtS: parseInt(process.env.STOP_AT_S, 10) || NOW_IN_S,
    letUserDoubleCheckInputsFor:
      parseInt(process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR, 10) || TEN_SECONDS,
  })

  if (options.projectId) {
    await waitForDb()
    const { modifiedCount } = await db.projects.updateOne(
      {
        _id: ObjectId(options.projectId),
        'overleaf.history.allowDowngrade': true,
      },
      { $unset: { 'overleaf.history.allowDowngrade': 1 } }
    )
    console.log(`modifiedCount: ${modifiedCount}`)
    process.exit(0)
  }

  await letUserDoubleCheckInputs(options)
  await waitForDb()

  let startId = options.firstProjectId

  let totalProcessed = 0
  while (getSecondsFromObjectId(startId) <= options.stopAtS) {
    let batchProcessed = 0
    const end = getSecondsFromObjectId(startId) + options.incrementByS
    let endId = ObjectId.createFromTime(end)
    const query = {
      _id: {
        // include edge
        $gte: startId,
        // exclude edge
        $lt: endId,
      },
      'overleaf.history.allowDowngrade': true,
    }
    const projects = await db.projects
      .find(query, { readPreference: READ_PREFERENCE_SECONDARY })
      .project({ _id: 1 })
      .limit(options.batchSize)
      .toArray()

    if (projects.length) {
      const projectIds = projects.map(project => project._id)
      if (options.verboseLogging) {
        console.log(
          `Processing projects with ids: ${JSON.stringify(projectIds)}`
        )
      } else {
        console.log(`Processing ${projects.length} projects`)
      }

      if (!options.dryRun) {
        await db.projects.updateMany(
          { _id: { $in: projectIds } },
          { $unset: { 'overleaf.history.allowDowngrade': 1 } }
        )
      } else {
        console.log(
          `skipping update of ${projectIds.length} projects in dry-run mode`
        )
      }

      totalProcessed += projectIds.length
      batchProcessed += projectIds.length

      if (projects.length === options.batchSize) {
        endId = projects[projects.length - 1]._id
      }
    }
    console.error(
      `Processed ${batchProcessed} from ${startId} until ${endId} (${totalProcessed} processed in total)`
    )

    startId = endId
  }
}

async function letUserDoubleCheckInputs(options) {
  console.error('Options:', JSON.stringify(options, null, 2))
  console.error(
    'Waiting for you to double check inputs for',
    options.letUserDoubleCheckInputsFor,
    'ms'
  )
  await sleep(options.letUserDoubleCheckInputsFor)
}

module.exports = main

if (require.main === module) {
  main()
    .then(() => {
      console.error('Done.')
      process.exit(0)
    })
    .catch(error => {
      console.error({ error })
      process.exit(1)
    })
}
