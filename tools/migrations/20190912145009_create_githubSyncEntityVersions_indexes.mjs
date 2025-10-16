/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      pid: 1,
      eid: 1,
    },
    name: 'pid_1_eid_1',
  },
  {
    key: {
      c: 1,
    },
    name: 'c_1',
    expireAfterSeconds: 2592000,
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.githubSyncEntityVersions, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(
      db.githubSyncEntityVersions,
      indexes
    )
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
