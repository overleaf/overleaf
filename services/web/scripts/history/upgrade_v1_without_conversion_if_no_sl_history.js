const SCRIPT_VERSION = 3
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
const USE_QUERY_HINT = process.env.USE_QUERY_HINT !== 'false'
const UPGRADE_FAILED_WITH_EMPTY_HISTORY =
  process.env.UPGRADE_FAILED_WITH_EMPTY_HISTORY === 'true'
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const {
  db,
  READ_PREFERENCE_SECONDARY,
} = require('../../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')

console.log({
  DRY_RUN,
  VERBOSE_LOGGING,
  WRITE_CONCURRENCY,
  BATCH_SIZE,
  USE_QUERY_HINT,
  UPGRADE_FAILED_WITH_EMPTY_HISTORY,
})

const RESULT = {
  DRY_RUN,
  projectsUpgraded: 0,
}

async function processBatch(projects) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
  console.log(RESULT)
}

async function processProject(project) {
  // safety check if history exists and there was a failed upgrade
  const anyDocHistory = await anyDocHistoryExists(project)
  const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
  if (
    project.overleaf &&
    project.overleaf.history &&
    project.overleaf.history.upgradeFailed
  ) {
    const emptyHistory = !anyDocHistory && !anyDocHistoryIndex
    if (emptyHistory && UPGRADE_FAILED_WITH_EMPTY_HISTORY) {
      console.log(
        `upgrading previously failed project ${project._id} with empty history`
      )
    } else {
      // a failed history upgrade might look like a v1 project, but history may be broken
      return
    }
  }
  const preserveHistory = await shouldPreserveHistory(project)
  if (preserveHistory) {
    // if we need to preserve history, then we must bail out if history exists
    if (anyDocHistory) {
      return
    }
    if (anyDocHistoryIndex) {
      return
    }
    return await doUpgradeForV1WithoutConversion(project)
  } else {
    // if preserveHistory false, then max 7 days of SL history
    // but v1 already record to both histories, so safe to upgrade
    return await doUpgradeForV1WithoutConversion(project)
  }
}

async function doUpgradeForV1WithoutConversion(project) {
  if (!DRY_RUN) {
    await db.projects.updateOne(
      { _id: project._id },
      {
        $set: {
          'overleaf.history.display': true,
          'overleaf.history.upgradedAt': new Date(),
          'overleaf.history.upgradeReason': `v1-without-sl-history/${SCRIPT_VERSION}`,
        },
      }
    )
  }
  if (VERBOSE_LOGGING) {
    console.log(`project ${project._id} converted to full project history`)
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

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
