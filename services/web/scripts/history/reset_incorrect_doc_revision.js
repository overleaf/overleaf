const DRY_RUN = process.env.DRY_RUN !== 'false'
const PROJECT_ID = process.env.PROJECT_ID
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const VERBOSE_PROJECT_NAMES = process.env.VERBOSE_PROJECT_NAMES === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 50
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 500
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
process.env.VERBOSE_LOGGING = VERBOSE_LOGGING

const { ObjectId } = require('mongodb')
const { db, waitForDb } = require('../../app/src/infrastructure/mongodb')
const { batchedUpdate } = require('../helpers/batchedUpdate')
const { promiseMapWithLimit } = require('../../app/src/util/promises')

const count = {
  projects: 0,
  projectsWithIncorrectRevDocs: 0,
  totalIncorrectRevDocs: 0,
  totalNanRevDocs: 0,
  totalNullRevDocs: 0,
  totalUndefinedRevDocs: 0,
  convertedRevs: 0,
}

async function main() {
  const projection = {
    _id: 1,
  }

  if (VERBOSE_PROJECT_NAMES) {
    projection.name = 1
  }

  const options = {}

  if (PROJECT_ID) {
    const project = await db.projects.findOne({ _id: ObjectId(PROJECT_ID) })
    await processProject(project)
  } else {
    await batchedUpdate(
      'projects',
      { 'overleaf.history.display': { $ne: true } },
      processBatch,
      projection,
      options
    )
  }
  console.log('Final')
}

async function processBatch(projects) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
}

async function processProject(project) {
  count.projects++

  const docs = await db.docs
    .find(
      {
        project_id: project._id,
        $or: [{ rev: null }, { rev: NaN }],
      },
      { _id: 1, rev: 1 }
    )
    .toArray()

  if (!docs || docs.length <= 0) {
    return
  }

  if (VERBOSE_LOGGING) {
    console.log(
      `Found ${docs.length} incorrect doc.rev for project ${
        project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
      }`
    )
  }

  count.projectsWithIncorrectRevDocs++
  count.totalIncorrectRevDocs += docs.length

  for (const doc of docs) {
    if (doc.rev === undefined) {
      count.totalUndefinedRevDocs++
    } else if (doc.rev === null) {
      count.totalNullRevDocs++
    } else if (isNaN(doc.rev)) {
      count.totalNanRevDocs++
    } else {
      console.error(`unknown 'rev' value: ${doc.rev}`)
    }
    if (!DRY_RUN) {
      console.log(`fixing rev of doc ${doc.id} from '${doc.rev}' to 0`)
      await db.docs.updateOne({ _id: doc._id }, { $set: { rev: 0 } })
      count.convertedRevs++
    }
  }
}

waitForDb()
  .then(main)
  .then(() => {
    console.log(count)
    process.exit(0)
  })
  .catch(err => {
    console.log('Something went wrong!', err)
    process.exit(1)
  })
