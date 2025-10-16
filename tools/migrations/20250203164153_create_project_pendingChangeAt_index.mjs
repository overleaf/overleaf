/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { 'overleaf.backup.pendingChangeAt': 1 },
    name: 'overleaf_backup_pendingChangeAt_1',
    partialFilterExpression: {
      'overleaf.backup.pendingChangeAt': { $exists: true },
    },
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projects, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
