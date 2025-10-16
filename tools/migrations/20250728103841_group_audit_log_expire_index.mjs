import Helpers from './lib/helpers.mjs'

const tags = ['saas']

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

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.groupAuditLogEntries, indexes)
}

const rollback = async client => {
  const { db } = client
  await Promise.all([
    Helpers.dropIndexesFromCollection(db.groupAuditLogEntries, indexes),
  ])
}

export default {
  tags,
  migrate,
  rollback,
}
