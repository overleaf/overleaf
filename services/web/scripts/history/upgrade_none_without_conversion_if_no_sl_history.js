const SCRIPT_VERSION = 1
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
const MAX_PROJECT_UPGRADES =
  parseInt(process.env.MAX_PROJECT_UPGRADES, 10) || false
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE

const { ReadPreference } = require('mongodb')
const { db } = require('../../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')
const ProjectHistoryHandler = require('../../app/src/Features/Project/ProjectHistoryHandler')

console.log({
  DRY_RUN,
  VERBOSE_LOGGING,
  WRITE_CONCURRENCY,
  BATCH_SIZE,
  MAX_PROJECT_UPGRADES,
})

const RESULT = {
  DRY_RUN,
  projectsUpgraded: 0,
}

async function processBatch(_, projects) {
  if (MAX_PROJECT_UPGRADES && RESULT.projectsUpgraded >= MAX_PROJECT_UPGRADES) {
    console.log(
      `MAX_PROJECT_UPGRADES limit (${MAX_PROJECT_UPGRADES}) reached. Stopping.`
    )
    process.exit(0)
  } else {
    await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
    console.log(RESULT)
  }
}

async function processProject(project) {
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
  const projectId = project._id
  if (!DRY_RUN) {
    // ensureHistoryExistsForProject resyncs project
    // Change to 'peek'ing the doc when resyncing should
    // be rolled out prior to using this script,
    //
    // Alternatively: do we need to resync now?
    // Probably a lot of dead projects - could we set a flag somehow
    // to resync later/if they ever become active (but for now just
    // make sure they have a history id?)
    try {
      await ProjectHistoryHandler.promises.ensureHistoryExistsForProject(
        projectId
      )
    } catch (err) {
      console.log('error setting up history:', err)
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

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
