const SCRIPT_VERSION = 2
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
const USE_QUERY_HINT = process.env.USE_QUERY_HINT !== 'false'
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const { ObjectId } = require('mongodb')
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
})

const RESULT = {
  DRY_RUN,
  projectsUpgraded: 0,
}

const ID_WHEN_FULL_PROJECT_HISTORY_ENABLED = '5a8d8a370000000000000000'
const OBJECT_ID_WHEN_FULL_PROJECT_HISTORY_ENABLED = new ObjectId(
  ID_WHEN_FULL_PROJECT_HISTORY_ENABLED
)
const DATETIME_WHEN_FULL_PROJECT_HISTORY_ENABLED =
  OBJECT_ID_WHEN_FULL_PROJECT_HISTORY_ENABLED.getTimestamp()

// set a default BATCH_LAST_ID at our cutoff point if none set
// we still check against this cut off point later, even if
// BATCH_LAST_ID is set to something problematic
if (!process.env.BATCH_LAST_ID) {
  process.env.BATCH_LAST_ID = ID_WHEN_FULL_PROJECT_HISTORY_ENABLED
}

async function processBatch(projects) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
  console.log(RESULT)
}

async function processProject(project) {
  // safety check
  if (
    project.overleaf &&
    project.overleaf.history &&
    project.overleaf.history.upgradeFailed
  ) {
    // a failed history upgrade might look like a v1 project, but history may be broken
    return
  }
  if (!projectCreatedAfterFullProjectHistoryEnabled(project)) {
    return
  }
  // if they have SL history, continue to send to both history systems (for now)
  const anyDocHistory = await anyDocHistoryExists(project)
  if (anyDocHistory) {
    return await doUpgradeForV1WithoutConversion(project, true)
  }
  const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
  if (anyDocHistoryIndex) {
    return await doUpgradeForV1WithoutConversion(project, true)
  }
  // or if no sl history, nothing to 'downgrade' to
  return await doUpgradeForV1WithoutConversion(project, false)
}

function projectCreatedAfterFullProjectHistoryEnabled(project) {
  return (
    project._id.getTimestamp() >= DATETIME_WHEN_FULL_PROJECT_HISTORY_ENABLED
  )
}

async function doUpgradeForV1WithoutConversion(project, allowDowngrade) {
  const setProperties = {
    'overleaf.history.display': true,
    'overleaf.history.upgradedAt': new Date(),
    'overleaf.history.upgradeReason': `v1-after-fph/${SCRIPT_VERSION}`,
  }
  if (allowDowngrade) {
    setProperties['overleaf.history.allowDowngrade'] = true
  }
  if (!DRY_RUN) {
    await db.projects.updateOne(
      { _id: project._id },
      {
        $set: setProperties,
      }
    )
  }
  if (VERBOSE_LOGGING) {
    console.log(
      `project ${project._id} converted to full project history${
        allowDowngrade ? ', with allowDowngrade' : ''
      }`
    )
  }
  RESULT.projectsUpgraded += 1
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
