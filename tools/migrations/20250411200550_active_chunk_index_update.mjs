import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const oldIndex = {
  name: 'projectId_1_startVersion_1',
  key: {
    projectId: 1,
    startVersion: 1,
  },
  unique: true,
  partialFilterExpression: { state: 'active' },
}

const newIndex = {
  name: 'projectId_1_startVersion_1_v2',
  key: {
    projectId: 1,
    startVersion: 1,
  },
  unique: true,
  partialFilterExpression: { state: { $in: ['active', 'closed'] } },
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectHistoryChunks, [newIndex])
  await Helpers.dropIndexesFromCollection(db.projectHistoryChunks, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectHistoryChunks, [oldIndex])
  await Helpers.dropIndexesFromCollection(db.projectHistoryChunks, [newIndex])
}

export default {
  tags,
  migrate,
  rollback,
}
