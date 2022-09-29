const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const projectIndexes = [
  {
    key: {
      projectId: 1,
    },
    name: 'project_id_1',
  },
]

const userIndexes = [
  {
    key: {
      userId: 1,
    },
    name: 'user_id_1',
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(
    db.projectAuditLogEntries,
    projectIndexes
  )
  await Helpers.addIndexesToCollection(db.userAuditLogEntries, userIndexes)
}

exports.rollback = async client => {
  const { db } = client
  await Promise.all([
    Helpers.dropIndexesFromCollection(
      db.projectAuditLogEntries,
      projectIndexes
    ),
    Helpers.dropIndexesFromCollection(db.userAuditLogEntries, userIndexes),
  ])
}
