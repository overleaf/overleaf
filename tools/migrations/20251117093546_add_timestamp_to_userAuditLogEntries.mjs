import Helpers from './lib/helpers.mjs'

const oldIndex = {
  key: {
    userId: 1,
  },
  name: 'user_id_1',
}

const newIndex = {
  key: {
    userId: 1,
    timestamp: -1,
  },
  name: 'userId_1_timestamp_-1',
}

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.userAuditLogEntries, [newIndex])
  await Helpers.dropIndexesFromCollection(db.userAuditLogEntries, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.userAuditLogEntries, [oldIndex])
  await Helpers.dropIndexesFromCollection(db.userAuditLogEntries, [newIndex])
}

export default {
  tags,
  migrate,
  rollback,
}
