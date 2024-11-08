import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { promiseMapWithLimit, promisify } from '@overleaf/promise-utils'
import { db } from '../app/src/infrastructure/mongodb.js'
import _ from 'lodash'
import { fileURLToPath } from 'node:url'

const sleep = promisify(setTimeout)

async function main(options) {
  if (!options) {
    options = {}
  }
  _.defaults(options, {
    writeConcurrency: parseInt(process.env.WRITE_CONCURRENCY, 10) || 10,
    performCleanup: process.argv.includes('--perform-cleanup'),
    fixPartialInserts: process.argv.includes('--fix-partial-inserts'),
    letUserDoubleCheckInputsFor: parseInt(
      process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR || 10 * 1000,
      10
    ),
  })

  await letUserDoubleCheckInputs(options)

  await batchedUpdate(
    db.projects,
    // array is not empty ~ array has one item
    { 'deletedFiles.0': { $exists: true } },
    async projects => {
      await processBatch(projects, options)
    },
    { _id: 1, deletedFiles: 1 }
  )
}

async function processBatch(projects, options) {
  await promiseMapWithLimit(
    options.writeConcurrency,
    projects,
    async project => {
      await processProject(project, options)
    }
  )
}

async function processProject(project, options) {
  await backFillFiles(project, options)

  if (options.performCleanup) {
    await cleanupProject(project)
  }
}

async function backFillFiles(project, options) {
  const projectId = project._id
  filterDuplicatesInPlace(project)
  project.deletedFiles.forEach(file => {
    file.projectId = projectId
  })

  if (options.fixPartialInserts) {
    await fixPartialInserts(project)
  } else {
    await db.deletedFiles.insertMany(project.deletedFiles)
  }
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

async function fixPartialInserts(project) {
  const seenFileIds = new Set(
    (
      await db.deletedFiles
        .find(
          { _id: { $in: project.deletedFiles.map(file => file._id) } },
          { projection: { _id: 1 } }
        )
        .toArray()
    ).map(file => file._id.toString())
  )
  project.deletedFiles = project.deletedFiles.filter(file => {
    const id = file._id.toString()
    if (seenFileIds.has(id)) return false
    seenFileIds.add(id)
    return true
  })
  if (project.deletedFiles.length > 0) {
    await db.deletedFiles.insertMany(project.deletedFiles)
  }
}

async function cleanupProject(project) {
  await db.projects.updateOne(
    { _id: project._id },
    { $set: { deletedFiles: [] } }
  )
}

async function letUserDoubleCheckInputs(options) {
  if (options.performCleanup) {
    console.error('BACK FILLING AND PERFORMING CLEANUP')
  } else {
    console.error(
      'BACK FILLING ONLY - You will need to rerun with --perform-cleanup'
    )
  }
  console.error(
    'Waiting for you to double check inputs for',
    options.letUserDoubleCheckInputsFor,
    'ms'
  )
  await sleep(options.letUserDoubleCheckInputsFor)
}

export default main

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main()
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
}
