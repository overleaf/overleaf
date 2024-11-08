import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { promiseMapWithLimit, promisify } from '@overleaf/promise-utils'
import { db } from '../app/src/infrastructure/mongodb.js'
import { fileURLToPath } from 'node:url'
import _ from 'lodash'

const sleep = promisify(setTimeout)

async function main(options) {
  if (!options) {
    options = {}
  }
  _.defaults(options, {
    writeConcurrency: parseInt(process.env.WRITE_CONCURRENCY, 10) || 10,
    performCleanup: process.argv.pop() === '--perform-cleanup',
    letUserDoubleCheckInputsFor: parseInt(
      process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR || 10 * 1000,
      10
    ),
  })

  await letUserDoubleCheckInputs(options)

  await batchedUpdate(
    db.projects,
    // array is not empty ~ array has one item
    { 'deletedDocs.0': { $exists: true } },
    async projects => {
      await processBatch(projects, options)
    },
    { _id: 1, deletedDocs: 1 }
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
  for (const doc of project.deletedDocs) {
    await backFillDoc(doc)
  }
  if (options.performCleanup) {
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
