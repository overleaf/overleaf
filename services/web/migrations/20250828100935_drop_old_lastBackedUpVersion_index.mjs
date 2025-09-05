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
  // Ensure the optimisation migration has run first to create the new index
  await Helpers.assertDependency(
    '20250827155732_optimise_lastBackedUpVersion_index'
  )
  // Drop the old index from 20250307120446_create_project_lastBackedUpVersion_index
  await Helpers.dropIndexesFromCollection(db.projects, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
