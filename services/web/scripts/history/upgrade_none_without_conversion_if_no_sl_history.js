const SCRIPT_VERSION = 1
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
const MAX_UPGRADES_TO_ATTEMPT =
  parseInt(process.env.MAX_UPGRADES_TO_ATTEMPT, 10) || false
const MAX_FAILURES = parseInt(process.env.MAX_FAILURES, 10) || 50
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const { ReadPreference } = require('mongodb')
const { db } = require('../../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')
const ProjectHistoryHandler = require('../../app/src/Features/Project/ProjectHistoryHandler')
const HistoryManager = require('../../app/src/Features/History/HistoryManager')

console.log({
  DRY_RUN,
  VERBOSE_LOGGING,
  WRITE_CONCURRENCY,
  BATCH_SIZE,
  MAX_UPGRADES_TO_ATTEMPT,
  MAX_FAILURES,
})

const RESULT = {
  DRY_RUN,
  attempted: 0,
  projectsUpgraded: 0,
  failed: 0,
  continueFrom: null,
}

let INTERRUPT = false

async function processBatch(_, projects) {
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
  const anyDocHistory = await anyDocHistoryExists(project)
  if (anyDocHistory) {
    return
  }
  const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
  if (anyDocHistoryIndex) {
    return
  }
  await doUpgradeForNoneWithoutConversion(project)
}

async function doUpgradeForNoneWithoutConversion(project) {
  if (RESULT.failed >= MAX_FAILURES) {
    return
  }
  if (MAX_UPGRADES_TO_ATTEMPT && RESULT.attempted >= MAX_UPGRADES_TO_ATTEMPT) {
    return
  }
  RESULT.attempted += 1
  const projectId = project._id
  if (!DRY_RUN) {
    // ensureHistoryExistsForProject resyncs project
    // Change to 'peek'ing the doc when resyncing should
    // be rolled out prior to using this script
    try {
      // Logic originally from ProjectHistoryHandler.ensureHistoryExistsForProject
      // However sends a force resync project to project history instead
      // of a resync request to doc-updater
      const historyId = await ProjectHistoryHandler.promises.getHistoryId(
        projectId
      )
      if (historyId != null) {
        return
      }
      const history = await HistoryManager.promises.initializeProject()
      if (history && history.overleaf_id) {
        await ProjectHistoryHandler.promises.setHistoryId(
          projectId,
          history.overleaf_id
        )
        await HistoryManager.promises.resyncProject(projectId, {
          force: true,
          origin: { kind: 'history-migration' },
        })
        await HistoryManager.promises.flushProject(projectId)
      }
    } catch (err) {
      RESULT.failed += 1
      console.error(`project ${project._id} FAILED with error: `, err)
      await db.projects.updateOne(
        { _id: project._id },
        {
          $set: {
            'overleaf.history.upgradeFailed': true,
          },
        }
      )
      return
    }
    await db.projects.updateOne(
      { _id: project._id },
      {
        $set: {
          'overleaf.history.display': true,
          'overleaf.history.upgradedAt': new Date(),
          'overleaf.history.upgradeReason': `none-without-sl-history/${SCRIPT_VERSION}`,
        },
      }
    )
  }
  if (VERBOSE_LOGGING) {
    console.log(`project ${project._id} converted to full project history`)
  }
  RESULT.projectsUpgraded += 1
}

async function anyDocHistoryExists(project) {
  return await db.docHistory.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: ReadPreference.SECONDARY,
    }
  )
}

async function anyDocHistoryIndexExists(project) {
  return await db.docHistoryIndex.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: ReadPreference.SECONDARY,
    }
  )
}

async function main() {
  const projection = {
    _id: 1,
    overleaf: 1,
  }
  const options = {
    hint: { _id: 1 },
  }
  await batchedUpdate(
    'projects',
    { 'overleaf.history.id': { $exists: false } },
    processBatch,
    projection,
    options
  )
  console.log('Final')
  console.log(RESULT)
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
