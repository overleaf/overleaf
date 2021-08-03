const SCRIPT_VERSION = 1
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE

const { ReadPreference } = require('mongodb')
const { db } = require('../../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')

console.log({ DRY_RUN, VERBOSE_LOGGING, WRITE_CONCURRENCY, BATCH_SIZE })

const RESULT = {
  DRY_RUN,
  projectsUpgraded: 0,
}

async function processBatch(_, projects) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
  console.log(RESULT)
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
  await doUpgradeForV1WithoutConversion(project)
}

async function doUpgradeForV1WithoutConversion(project) {
  if (!DRY_RUN) {
    db.projects.updateOne(
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
  await batchedUpdate(
    'projects',
    {
      $and: [
        { 'overleaf.history.display': { $ne: true } },
        { 'overleaf.history.id': { $exists: true } },
      ],
    },
    processBatch,
    projection
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
