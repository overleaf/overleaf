/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

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

exports.migrate = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.projectHistoryChunks, indexes)
}

exports.rollback = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.projectHistoryChunks, indexes)
}
