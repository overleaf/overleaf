const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    // expire after 2.5 years
    expireAfterSeconds: 60 * 60 * 24 * 365 * 2.5,
    key: {
      timestamp: 1,
    },
    name: 'timestamp_1',
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectAuditLogEntries, indexes)
  await Helpers.addIndexesToCollection(db.userAuditLogEntries, indexes)
}

exports.rollback = async client => {
  const { db } = client
  await Promise.all([
    Helpers.dropIndexesFromCollection(db.userAuditLogEntries, indexes),
    Helpers.dropIndexesFromCollection(db.projectAuditLogEntries, indexes),
  ])
}
