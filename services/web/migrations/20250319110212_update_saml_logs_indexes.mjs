/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexesToDelete = [
  {
    key: {
      providerId: 1,
    },
    name: 'providerId_1',
  },
  {
    key: {
      sessionId: 1,
    },
    name: 'sessionId_1',
  },
]

const indexesToAdd = [
  {
    key: {
      providerId: 1,
      _id: 1,
    },
    name: 'providerId_id_1',
  },
  {
    key: {
      sessionId: 1,
      _id: 1,
    },
    name: 'sessionId_id_1',
  },
  {
    key: {
      userId: 1,
      _id: 1,
    },
    name: 'userId_id_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.samlLogs, indexesToAdd)
  await Helpers.dropIndexesFromCollection(db.samlLogs, indexesToDelete)
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.addIndexesToCollection(db.samlLogs, indexesToDelete)
    await Helpers.dropIndexesFromCollection(db.samlLogs, indexesToAdd)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
