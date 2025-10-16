/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      requestId: 1,
    },
    name: 'requestId_1',
  },
  {
    // expire after 24 hours
    expireAfterSeconds: 60 * 60 * 24,
    key: {
      createdAt: 1,
    },
    name: 'createdAt_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.samlCache, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.samlCache, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
