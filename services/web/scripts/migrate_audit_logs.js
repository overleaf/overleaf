const { batchedUpdate } = require('./helpers/batchedUpdate')
const { promiseMapWithLimit, promisify } = require('../app/src/util/promises')
const { db, ObjectId, waitForDb } = require('../app/src/infrastructure/mongodb')
const sleep = promisify(setTimeout)
const _ = require('lodash')

async function main(options) {
  if (!options) {
    options = {}
  }
  _.defaults(options, {
    dryRun: process.env.DRY_RUN !== 'false',
    projectId: process.env.PROJECT_ID,
    userId: process.env.USER_ID,
    writeConcurrency: parseInt(process.env.WRITE_CONCURRENCY, 10) || 10,
    letUserDoubleCheckInputsFor: parseInt(
      process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR || 10 * 1000,
      10
    ),
  })

  await letUserDoubleCheckInputs(options)

  if (options.projectId) {
    console.log('migrating projectId=' + options.projectId)
    const project = await db.projects.findOne(
      { _id: ObjectId(options.projectId) },
      { _id: 1, auditLog: 1 }
    )
    await processProject(project, options)
  } else if (options.userId) {
    console.log('migrating userId=' + options.userId)
    const user = await db.users.findOne(
      { _id: ObjectId(options.userId) },
      { _id: 1, auditLog: 1 }
    )
    await processUser(user, options)
  } else {
    await batchedUpdate(
      'users',
      { auditLog: { $exists: true } },
      async (_, users) => {
        await processUsersBatch(users, options)
      },
      { _id: 1, auditLog: 1 }
    )
  }
}

async function processUsersBatch(users, options) {
  await promiseMapWithLimit(options.writeConcurrency, users, async user => {
    await processUser(user, options)
  })
}

async function processUser(user, options) {
  const entries = user.auditLog.map(log => ({ ...log, userId: user._id }))
  if (!options.dryRun && entries?.length > 0) {
    await db.userAuditLogEntries.insertMany(entries)
  }

  if (!options.dryRun) {
    await db.users.updateOne({ _id: user._id }, { $unset: { auditLog: 1 } })
  }

  const projects = await db.projects.find(
    { owner_ref: user._id, auditLog: { $exists: true } },
    { _id: 1, auditLog: 1 }
  )
  projects.forEach(project => processProject(project, options))
}

async function processProject(project, options) {
  const entries = project.auditLog.map(log => ({
    ...log,
    projectId: project._id,
  }))

  if (!options.dryRun && entries?.length > 0) {
    await db.projectAuditLogEntries.insertMany(entries)
  }

  if (!options.dryRun) {
    await db.projects.updateOne(
      { _id: project._id },
      { $unset: { auditLog: 1 } }
    )
  }
}

async function letUserDoubleCheckInputs(options) {
  const allOptions = {
    ...options,
    // batchedUpdate() environment variables
    BATCH_DESCENDING: process.env.BATCH_DESCENDING,
    BATCH_SIZE: process.env.BATCH_SIZE,
    VERBOSE_LOGGING: process.env.VERBOSE_LOGGING,
    BATCH_LAST_ID: process.env.BATCH_LAST_ID,
    BATCH_RANGE_END: process.env.BATCH_RANGE_END,
  }
  console.error('Options:', JSON.stringify(allOptions, null, 2))
  console.error(
    'Waiting for you to double check inputs for',
    options.letUserDoubleCheckInputsFor,
    'ms'
  )
  await sleep(options.letUserDoubleCheckInputsFor)
}

module.exports = main

if (require.main === module) {
  waitForDb()
    .then(main)
    .then(() => {
      console.log('Done.')
      process.exit(0)
    })
    .catch(error => {
      console.error({ error })
      process.exit(1)
    })
}
