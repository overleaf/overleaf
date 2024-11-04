import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.js'
import { promisify } from 'node:util'
import mongodb from 'mongodb-legacy'
import {
  db,
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import DeleteOrphanedDataHelper from './delete_orphaned_data_helper.mjs'

const { ObjectId } = mongodb
const sleep = promisify(setTimeout)
const { getHardDeletedProjectIds } = DeleteOrphanedDataHelper

const NOW_IN_S = Date.now() / 1000
const ONE_WEEK_IN_S = 60 * 60 * 24 * 7
const TEN_SECONDS = 10 * 1000

const DRY_RUN = process.env.DRY_RUN === 'true'
if (!process.env.BATCH_LAST_ID) {
  console.error('Set BATCH_LAST_ID and re-run.')
  process.exit(1)
}
const BATCH_LAST_ID = new ObjectId(process.env.BATCH_LAST_ID)
const INCREMENT_BY_S = parseInt(process.env.INCREMENT_BY_S, 10) || ONE_WEEK_IN_S
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1000
const READ_CONCURRENCY_SECONDARY =
  parseInt(process.env.READ_CONCURRENCY_SECONDARY, 10) || 1000
const READ_CONCURRENCY_PRIMARY =
  parseInt(process.env.READ_CONCURRENCY_PRIMARY, 10) || 500
const STOP_AT_S = parseInt(process.env.STOP_AT_S, 10) || NOW_IN_S
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const LET_USER_DOUBLE_CHECK_INPUTS_FOR =
  parseInt(process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR, 10) || TEN_SECONDS

function getSecondsFromObjectId(id) {
  return id.getTimestamp().getTime() / 1000
}

async function main() {
  await letUserDoubleCheckInputs()
  let lowerProjectId = BATCH_LAST_ID

  let nProjectsProcessedTotal = 0
  let nProjectsWithOrphanedDocsTotal = 0
  let nDeletedDocsTotal = 0
  while (getSecondsFromObjectId(lowerProjectId) <= STOP_AT_S) {
    const upperTime = getSecondsFromObjectId(lowerProjectId) + INCREMENT_BY_S
    let upperProjectId = ObjectId.createFromTime(upperTime)
    const query = {
      project_id: {
        // exclude edge
        $gt: lowerProjectId,
        // include edge
        $lte: upperProjectId,
      },
    }
    const docs = await db.docs
      .find(query, { readPreference: READ_PREFERENCE_SECONDARY })
      .project({ project_id: 1 })
      .sort({ project_id: 1 })
      .limit(BATCH_SIZE)
      .toArray()

    if (docs.length) {
      const projectIds = Array.from(
        new Set(docs.map(doc => doc.project_id.toString()))
      ).map(id => new ObjectId(id))
      console.log('Checking projects', JSON.stringify(projectIds))
      const { nProjectsWithOrphanedDocs, nDeletedDocs } =
        await processBatch(projectIds)
      nProjectsProcessedTotal += projectIds.length
      nProjectsWithOrphanedDocsTotal += nProjectsWithOrphanedDocs
      nDeletedDocsTotal += nDeletedDocs

      if (docs.length === BATCH_SIZE) {
        // This project may have more than BATCH_SIZE docs.
        const lastDoc = docs[docs.length - 1]
        // Resume from after this projectId.
        upperProjectId = lastDoc.project_id
      }
    }
    console.error(
      'Processed %d projects ' +
        '(%d projects with orphaned docs/%d docs deleted) ' +
        'until %s',
      nProjectsProcessedTotal,
      nProjectsWithOrphanedDocsTotal,
      nDeletedDocsTotal,
      upperProjectId
    )

    lowerProjectId = upperProjectId
  }
}

async function getProjectDocs(projectId) {
  return await db.docs
    .find(
      { project_id: projectId },
      {
        projection: { _id: 1 },
        readPreference: READ_PREFERENCE_PRIMARY,
      }
    )
    .toArray()
}

async function processBatch(projectIds) {
  const projectsWithOrphanedDocs = await getHardDeletedProjectIds({
    projectIds,
    READ_CONCURRENCY_PRIMARY,
    READ_CONCURRENCY_SECONDARY,
  })

  let nDeletedDocs = 0
  async function countOrphanedDocs(projectId) {
    const docs = await getProjectDocs(projectId)
    nDeletedDocs += docs.length
    console.log(
      'Deleted project %s has %s orphaned docs: %s',
      projectId,
      docs.length,
      JSON.stringify(docs.map(doc => doc._id))
    )
  }
  await promiseMapWithLimit(
    READ_CONCURRENCY_PRIMARY,
    projectsWithOrphanedDocs,
    countOrphanedDocs
  )
  if (!DRY_RUN) {
    await promiseMapWithLimit(
      WRITE_CONCURRENCY,
      projectsWithOrphanedDocs,
      DocstoreManager.promises.destroyProject
    )
  }

  const nProjectsWithOrphanedDocs = projectsWithOrphanedDocs.length
  return { nProjectsWithOrphanedDocs, nDeletedDocs }
}

async function letUserDoubleCheckInputs() {
  console.error(
    'Options:',
    JSON.stringify(
      {
        BATCH_LAST_ID,
        BATCH_SIZE,
        DRY_RUN,
        INCREMENT_BY_S,
        STOP_AT_S,
        READ_CONCURRENCY_SECONDARY,
        READ_CONCURRENCY_PRIMARY,
        WRITE_CONCURRENCY,
        LET_USER_DOUBLE_CHECK_INPUTS_FOR,
      },
      null,
      2
    )
  )
  console.error(
    'Waiting for you to double check inputs for',
    LET_USER_DOUBLE_CHECK_INPUTS_FOR,
    'ms'
  )
  await sleep(LET_USER_DOUBLE_CHECK_INPUTS_FOR)
}

try {
  await main()
  console.error('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
