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
    { 'deletedFiles.0': { $exists: true } },
    processBatch,
    { _id: 1, deletedFiles: 1 }
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
  await backFillFiles(project)

  if (PERFORM_CLEANUP) {
    await cleanupProject(project)
  }
}

async function backFillFiles(project) {
  const projectId = project._id
  filterDuplicatesInPlace(project)
  project.deletedFiles.forEach(file => {
    file.projectId = projectId
  })
  await db.deletedFiles.insertMany(project.deletedFiles)
}

function filterDuplicatesInPlace(project) {
  const fileIds = new Set()
  project.deletedFiles = project.deletedFiles.filter(file => {
    const id = file._id.toString()
    if (fileIds.has(id)) return false
    fileIds.add(id)
    return true
  })
}

async function cleanupProject(project) {
  await db.projects.updateOne(
    { _id: project._id },
    { $set: { deletedFiles: [] } }
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
