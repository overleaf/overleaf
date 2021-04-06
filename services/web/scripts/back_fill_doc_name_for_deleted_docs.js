const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

const { batchedUpdate } = require('./helpers/batchedUpdate')
const { promiseMapWithLimit, promisify } = require('../app/src/util/promises')
const { db } = require('../app/src/infrastructure/mongodb')
const sleep = promisify(setTimeout)

const PERFORM_CLEANUP = process.argv.pop() === '--perform-cleanup'
const LET_USER_DOUBLE_CHECK_INPUTS_FOR = parseInt(
  process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR || 10 * 1000,
  10
)

async function main() {
  await letUserDoubleCheckInputs()

  await batchedUpdate(
    'projects',
    // array is not empty ~ array has one item
    { 'deletedDocs.0': { $exists: true } },
    processBatch,
    { _id: 1, deletedDocs: 1 }
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })

async function processBatch(_, projects) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
}

async function processProject(project) {
  for (const doc of project.deletedDocs) {
    await backFillDoc(doc)
  }
  if (PERFORM_CLEANUP) {
    await cleanupProject(project)
  }
}

async function backFillDoc(doc) {
  const { name, deletedAt } = doc
  await db.docs.updateOne({ _id: doc._id }, { $set: { name, deletedAt } })
}

async function cleanupProject(project) {
  await db.projects.updateOne(
    { _id: project._id },
    { $set: { deletedDocs: [] } }
  )
}

async function letUserDoubleCheckInputs() {
  if (PERFORM_CLEANUP) {
    console.error('BACK FILLING AND PERFORMING CLEANUP')
  } else {
    console.error(
      'BACK FILLING ONLY - You will need to rerun with --perform-cleanup'
    )
  }
  console.error(
    'Waiting for you to double check inputs for',
    LET_USER_DOUBLE_CHECK_INPUTS_FOR,
    'ms'
  )
  await sleep(LET_USER_DOUBLE_CHECK_INPUTS_FOR)
}
