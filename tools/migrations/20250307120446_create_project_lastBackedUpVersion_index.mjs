/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { 'overleaf.backup.lastBackedUpVersion': 1 },
    name: 'overleaf.backup.lastBackedUpVersion_1',
    partialFilterExpression: {
      'overleaf.backup.lastBackedUpVersion': { $in: [null] },
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
