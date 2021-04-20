const { promisify } = require('util')
const { ObjectId, ReadPreference } = require('mongodb')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const sleep = promisify(setTimeout)

const NOW_IN_S = Date.now() / 1000
const ONE_WEEK_IN_S = 60 * 60 * 24 * 7
const TEN_SECONDS = 10 * 1000

const CACHE_SIZE = parseInt(process.env.CACHE_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN === 'true'
if (!process.env.FIRST_PROJECT_ID) {
  console.error('Set FIRST_PROJECT_ID and re-run.')
  process.exit(1)
}
const FIRST_PROJECT_ID = ObjectId(process.env.FIRST_PROJECT_ID)
const INCREMENT_BY_S = parseInt(process.env.INCREMENT_BY_S, 10) || ONE_WEEK_IN_S
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1000
const STOP_AT_S = parseInt(process.env.STOP_AT_S, 10) || NOW_IN_S
const LET_USER_DOUBLE_CHECK_INPUTS_FOR =
  parseInt(process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR, 10) || TEN_SECONDS

const DUMMY_NAME = 'unknown.tex'
const DUMMY_TIME = new Date('2021-04-12T00:00:00.000Z')

const LRUCache = require('lru-cache')
const deletedProjectsCache = new LRUCache({
  max: CACHE_SIZE
})

function getSecondsFromObjectId(id) {
  return id.getTimestamp().getTime() / 1000
}

async function main() {
  await letUserDoubleCheckInputs()
  await waitForDb()

  let startId = FIRST_PROJECT_ID

  let nProcessed = 0
  while (getSecondsFromObjectId(startId) <= STOP_AT_S) {
    const end = getSecondsFromObjectId(startId) + INCREMENT_BY_S
    let endId = ObjectId.createFromTime(end)
    const query = {
      project_id: {
        // include edge
        $gte: startId,
        // exclude edge
        $lt: endId
      },
      deleted: true,
      name: {
        $exists: false
      }
    }
    const docs = await db.docs
      .find(query, { readPreference: ReadPreference.SECONDARY })
      .project({ _id: 1, project_id: 1 })
      .limit(BATCH_SIZE)
      .toArray()

    if (docs.length) {
      const docIds = docs.map(doc => doc._id)
      console.log('Back filling dummy meta data for', JSON.stringify(docIds))
      await processBatch(docs)
      nProcessed += docIds.length

      if (docs.length === BATCH_SIZE) {
        endId = docs[docs.length - 1].project_id
      }
    }
    console.error('Processed %d until %s', nProcessed, endId)

    startId = endId
  }
}

async function getDeletedProject(projectId) {
  const cacheKey = projectId.toString()
  if (deletedProjectsCache.has(cacheKey)) {
    return deletedProjectsCache.get(cacheKey)
  }
  const deletedProject = await db.deletedProjects.findOne(
    { 'deleterData.deletedProjectId': projectId },
    {
      projection: {
        _id: 1,
        'project.deletedDocs': 1
      }
    }
  )
  deletedProjectsCache.set(cacheKey, deletedProject)
  return deletedProject
}

async function processBatch(docs) {
  for (const doc of docs) {
    const { _id: docId, project_id: projectId } = doc
    const deletedProject = await getDeletedProject(projectId)
    let name = DUMMY_NAME
    let deletedAt = DUMMY_TIME
    if (deletedProject) {
      const project = deletedProject.project
      if (project) {
        const deletedDoc =
          project.deletedDocs &&
          project.deletedDocs.find(deletedDoc => docId.equals(deletedDoc._id))
        if (deletedDoc) {
          console.log('Found deletedDoc for %s', docId)
          name = deletedDoc.name
          deletedAt = deletedDoc.deletedAt
        } else {
          console.log('Missing deletedDoc for %s', docId)
        }
      } else {
        console.log('Orphaned deleted doc %s (failed hard deletion)', docId)
      }
    } else {
      console.log('Orphaned deleted doc %s (no deletedProjects entry)', docId)
    }
    if (DRY_RUN) continue
    await db.docs.updateOne({ _id: docId }, { $set: { name, deletedAt } })
  }
}

async function letUserDoubleCheckInputs() {
  console.error(
    'Options:',
    JSON.stringify(
      {
        BATCH_SIZE,
        CACHE_SIZE,
        DRY_RUN,
        FIRST_PROJECT_ID,
        INCREMENT_BY_S,
        STOP_AT_S,
        LET_USER_DOUBLE_CHECK_INPUTS_FOR
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

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
