const SCRIPT_VERSION = 1
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
const USE_QUERY_HINT = process.env.USE_QUERY_HINT !== 'false'
const RETRY_FAILED = process.env.RETRY_FAILED === 'true'
const MAX_UPGRADES_TO_ATTEMPT =
  parseInt(process.env.MAX_UPGRADES_TO_ATTEMPT, 10) || false
const MAX_FAILURES = parseInt(process.env.MAX_FAILURES, 10) || 50
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const PROJECT_ID = process.env.PROJECT_ID

const { ObjectId } = require('mongodb')
const {
  db,
  waitForDb,
  READ_PREFERENCE_SECONDARY,
} = require('../../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')
const ProjectHistoryController = require('../../modules/history-migration/app/src/ProjectHistoryController')

console.log({
  DRY_RUN,
  VERBOSE_LOGGING,
  WRITE_CONCURRENCY,
  BATCH_SIZE,
  MAX_UPGRADES_TO_ATTEMPT,
  MAX_FAILURES,
  USE_QUERY_HINT,
  RETRY_FAILED,
  PROJECT_ID,
})

const RESULT = {
  DRY_RUN,
  attempted: 0,
  projectsUpgraded: 0,
  failed: 0,
  continueFrom: null,
}

let INTERRUPT = false

async function processBatch(projects) {
  if (projects.length && projects[0]._id) {
    RESULT.continueFrom = projects[0]._id
  }
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
  console.log(RESULT)
  if (INTERRUPT) {
    // ctrl+c
    console.log('Terminated by SIGINT')
    process.exit(0)
  }
  if (RESULT.failed >= MAX_FAILURES) {
    console.log(`MAX_FAILURES limit (${MAX_FAILURES}) reached. Stopping.`)
    process.exit(0)
  }
  if (MAX_UPGRADES_TO_ATTEMPT && RESULT.attempted >= MAX_UPGRADES_TO_ATTEMPT) {
    console.log(
      `MAX_UPGRADES_TO_ATTEMPT limit (${MAX_UPGRADES_TO_ATTEMPT}) reached. Stopping.`
    )
    process.exit(0)
  }
}

async function processProject(project) {
  if (INTERRUPT) {
    return
  }
  // skip safety check if we want to retry failed upgrades
  if (!RETRY_FAILED) {
    if (project.overleaf && project.overleaf.history) {
      if (
        project.overleaf.history.conversionFailed ||
        project.overleaf.history.upgradeFailed
      ) {
        // we don't want to attempt upgrade on projects
        // that have been previously attempted and failed
        return
      }
    }
  }
  const preserveHistory = await shouldPreserveHistory(project)
  if (preserveHistory) {
    const anyDocHistory = await anyDocHistoryExists(project)
    if (anyDocHistory) {
      return await doUpgradeForV1WithConversion(project)
    }
    const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
    if (anyDocHistoryIndex) {
      return await doUpgradeForV1WithConversion(project)
    }
  }
}

async function doUpgradeForV1WithConversion(project) {
  if (RESULT.failed >= MAX_FAILURES) {
    return
  }
  if (MAX_UPGRADES_TO_ATTEMPT && RESULT.attempted >= MAX_UPGRADES_TO_ATTEMPT) {
    return
  }
  RESULT.attempted += 1
  const projectId = project._id
  // migrateProjectHistory expects project id as a string
  const projectIdString = project._id.toString()
  if (!DRY_RUN) {
    try {
      // We treat these essentially as None projects, the V1 history is irrelevant,
      // so we will delete it, and do a conversion as if we're a None project
      await ProjectHistoryController.deleteProjectHistory(projectIdString)
      if (VERBOSE_LOGGING) {
        console.log(
          `project ${projectId} existing full project history deleted`
        )
      }
      await ProjectHistoryController.migrateProjectHistory(projectIdString)
    } catch (err) {
      // if migrateProjectHistory fails, it cleans up by deleting
      // the history and unsetting the history id
      // therefore a failed project will still look like a 'None with conversion' project
      RESULT.failed += 1
      console.error(`project ${projectId} FAILED with error: `, err)
      // We set a failed flag so future runs of the script don't automatically retry
      await db.projects.updateOne(
        { _id: projectId },
        {
          $set: {
            'overleaf.history.conversionFailed': true,
          },
        }
      )
      return
    }
    await db.projects.updateOne(
      { _id: projectId },
      {
        $set: {
          'overleaf.history.upgradeReason': `v1-with-conversion/${SCRIPT_VERSION}`,
        },
        $unset: {
          'overleaf.history.upgradeFailed': true,
          'overleaf.history.conversionFailed': true,
        },
      }
    )
  }
  if (VERBOSE_LOGGING) {
    console.log(
      `project ${projectId} converted and upgraded to full project history`
    )
  }
  RESULT.projectsUpgraded += 1
}

async function shouldPreserveHistory(project) {
  return await db.projectHistoryMetaData.findOne(
    {
      $and: [
        { project_id: { $eq: project._id } },
        { preserveHistory: { $eq: true } },
      ],
    },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
}

async function anyDocHistoryExists(project) {
  return await db.docHistory.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
}

async function anyDocHistoryIndexExists(project) {
  return await db.docHistoryIndex.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
}

async function main() {
  if (PROJECT_ID) {
    await waitForDb()
    const project = await db.projects.findOne({ _id: ObjectId(PROJECT_ID) })
    await processProject(project)
  } else {
    const projection = {
      _id: 1,
      overleaf: 1,
    }
    const options = {}
    if (USE_QUERY_HINT) {
      options.hint = { _id: 1 }
    }
    await batchedUpdate(
      'projects',
      {
        $and: [
          { 'overleaf.history.display': { $ne: true } },
          { 'overleaf.history.id': { $exists: true } },
        ],
      },
      processBatch,
      projection,
      options
    )
    console.log('Final')
    console.log(RESULT)
  }
}

// Upgrading history is not atomic, if we quit out mid-initialisation
// then history could get into a broken state
// Instead, skip any unprocessed projects and exit() at end of the batch.
process.on('SIGINT', function () {
  console.log('Caught SIGINT, waiting for in process upgrades to complete')
  INTERRUPT = true
})

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
