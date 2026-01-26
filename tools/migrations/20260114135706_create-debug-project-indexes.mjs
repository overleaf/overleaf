/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { 'overleaf.isDebugCopyOf': 1, owner_ref: 1, lastUpdated: 1 },
    name: 'owner_ref_1_lastUpdated_1_debugCopies',
    partialFilterExpression: {
      'overleaf.isDebugCopyOf': { $type: 'objectId' },
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
