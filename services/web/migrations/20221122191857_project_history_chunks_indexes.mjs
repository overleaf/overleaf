/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: { projectId: 1, startVersion: 1 },
    name: 'projectId_1_startVersion_1',
    partialFilterExpression: { state: 'active' },
    unique: true,
  },
  {
    key: { state: 1 },
    name: 'state_1',
    partialFilterExpression: { state: 'deleted' },
  },
]

const migrate = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.projectHistoryChunks, indexes)
}

const rollback = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.projectHistoryChunks, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
