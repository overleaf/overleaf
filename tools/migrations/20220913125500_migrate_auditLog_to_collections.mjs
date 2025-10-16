import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from './lib/mongodb.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async () => {
  await batchedUpdate(
    db.users,
    { auditLog: { $exists: true } },
    async users => {
      await processUsersBatch(users)
    },
    { _id: 1, auditLog: 1 }
  )

  await batchedUpdate(
    db.projects,
    { auditLog: { $exists: true } },
    async projects => {
      await processProjectsBatch(projects)
    },
    { _id: 1, auditLog: 1 }
  )
}

async function processUsersBatch(users) {
  if (!users || users.length <= 0) {
    return
  }

  const entries = users
    .map(user => user.auditLog.map(log => ({ ...log, userId: user._id })))
    .flat()

  if (entries?.length > 0) {
    await db.userAuditLogEntries.insertMany(entries)
  }

  const userIds = users.map(user => user._id)
  await db.users.updateMany(
    { _id: { $in: userIds } },
    { $unset: { auditLog: 1 } }
  )
}

async function processProjectsBatch(projects) {
  if (!projects || projects.length <= 0) {
    return
  }

  const entries = projects
    .map(project =>
      project.auditLog.map(log => ({ ...log, projectId: project._id }))
    )
    .flat()

  if (entries?.length > 0) {
    await db.projectAuditLogEntries.insertMany(entries)
  }

  const projectIds = projects.map(project => project._id)
  await db.projects.updateMany(
    { _id: { $in: projectIds } },
    { $unset: { auditLog: 1 } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
