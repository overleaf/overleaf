/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const oldIndexes = [
  {
    key: {
      state: 1,
    },
    name: 'state_1',
    partialFilterExpression: {
      state: 'deleted',
    },
  },
  {
    key: {
      state: -1,
    },
    name: 'state_pending',
    partialFilterExpression: {
      state: 'pending',
    },
  },
]
const newIndexes = [
  {
    key: {
      updatedAt: 1,
    },
    name: 'deleted_updated_at',
    partialFilterExpression: {
      state: 'deleted',
    },
  },
  {
    key: {
      updatedAt: -1,
    },
    name: 'pending_updated_at',
    partialFilterExpression: {
      state: 'pending',
    },
  },
]

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectHistoryChunks, newIndexes)
  await Helpers.dropIndexesFromCollection(db.projectHistoryChunks, oldIndexes)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectHistoryChunks, oldIndexes)
  await Helpers.dropIndexesFromCollection(db.projectHistoryChunks, newIndexes)
}
