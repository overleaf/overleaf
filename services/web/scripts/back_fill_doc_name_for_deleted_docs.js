const { batchedUpdate } = require('./helpers/batchedUpdate')
const { promiseMapWithLimit, promisify } = require('../app/src/util/promises')
const { db } = require('../app/src/infrastructure/mongodb')
const sleep = promisify(setTimeout)
const _ = require('lodash')

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
    'projects',
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

module.exports = main

if (require.main === module) {
  main()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error({ error })
      process.exit(1)
    })
}
