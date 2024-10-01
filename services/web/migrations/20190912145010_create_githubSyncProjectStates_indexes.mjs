/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      project_id: 1,
    },
    name: 'project_id_1',
  },
  {
    key: {
      owner_id: 1,
    },
    name: 'owner_id_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.githubSyncProjectStates, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.githubSyncProjectStates, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
