import Helpers from './lib/helpers.mjs'

const oldIndex = {
  key: {
    projectId: 1,
  },
  name: 'project_id_1',
}

const newIndex = {
  key: {
    projectId: 1,
    timestamp: -1,
  },
  name: 'projectId_1_timestamp_-1',
}

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectAuditLogEntries, [newIndex])
  await Helpers.dropIndexesFromCollection(db.projectAuditLogEntries, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectAuditLogEntries, [oldIndex])
  await Helpers.dropIndexesFromCollection(db.projectAuditLogEntries, [newIndex])
}

export default {
  tags,
  migrate,
  rollback,
}
