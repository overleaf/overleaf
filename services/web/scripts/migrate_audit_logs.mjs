import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { promiseMapWithLimit, promisify } from '@overleaf/promise-utils'
import { db, ObjectId } from '../app/src/infrastructure/mongodb.js'
import _ from 'lodash'
import { fileURLToPath } from 'node:url'

const sleep = promisify(setTimeout)

async function main(options) {
  if (!options) {
    options = {}
  }
  _.defaults(options, {
    dryRun: process.env.DRY_RUN !== 'false',
    projectId: process.env.PROJECT_ID,
    userId: process.env.USER_ID,
    skipUsersMigration: process.env.SKIP_USERS_MIGRATION === 'true',
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
      { _id: new ObjectId(options.projectId) },
      { _id: 1, auditLog: 1 }
    )
    if (!project || !project.auditLog) {
      console.error('unable to process project', project)
      return
    }
    await processProjectsBatch([project], options)
  } else if (options.userId) {
    console.log('migrating userId=' + options.userId)
    const user = await db.users.findOne(
      { _id: new ObjectId(options.userId) },
      { _id: 1, auditLog: 1 }
    )
    if (!user || !user.auditLog) {
      console.error('unable to process user', user)
      return
    }
    await processUsersBatch([user], options)
  } else {
    if (!options.skipUsersMigration) {
      await batchedUpdate(
        db.users,
        { auditLog: { $exists: true } },
        async users => {
          await processUsersBatch(users, options)
        },
        { _id: 1, auditLog: 1 }
      )
    }

    // most projects are processed after its owner has been processed, but only those
    // users with an existing `auditLog` have been taken into consideration, leaving
    // some projects orphan. This batched update processes all remaining projects.
    await batchedUpdate(
      db.projects,
      { auditLog: { $exists: true } },
      async projects => {
        await processProjectsBatch(projects, options)
      },
      { _id: 1, auditLog: 1 }
    )
  }
}

async function processUsersBatch(users, options) {
  if (!users || users.length <= 0) {
    return
  }

  const entries = users
    .map(user => user.auditLog.map(log => ({ ...log, userId: user._id })))
    .flat()

  if (!options.dryRun && entries?.length > 0) {
    await db.userAuditLogEntries.insertMany(entries)
  }

  if (!options.dryRun) {
    const userIds = users.map(user => user._id)
    await db.users.updateMany(
      { _id: { $in: userIds } },
      { $unset: { auditLog: 1 } }
    )
  }

  await promiseMapWithLimit(options.writeConcurrency, users, async user => {
    const projects = await db.projects
      .find(
        { owner_ref: user._id, auditLog: { $exists: true } },
        { _id: 1, auditLog: 1 }
      )
      .toArray()
    await processProjectsBatch(projects, options)
  })
}

async function processProjectsBatch(projects, options) {
  if (!projects || projects.length <= 0) {
    return
  }

  const entries = projects
    .map(project =>
      project.auditLog.map(log => ({ ...log, projectId: project._id }))
    )
    .flat()

  if (!options.dryRun && entries?.length > 0) {
    await db.projectAuditLogEntries.insertMany(entries)
  }

  if (!options.dryRun) {
    const projectIds = projects.map(project => project._id)
    await db.projects.updateMany(
      { _id: { $in: projectIds } },
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
    SKIP_USERS_MIGRATION: process.env.SKIP_USERS_MIGRATION,
  }
  console.error('Options:', JSON.stringify(allOptions, null, 2))
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
    console.log('Done.')
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
}
