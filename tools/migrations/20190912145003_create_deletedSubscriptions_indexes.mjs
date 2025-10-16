/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    unique: true,
    key: {
      'subscription._id': 1,
    },
    name: 'subscription._id_1',
  },
  {
    key: {
      'subscription.admin_id': 1,
    },
    name: 'subscription.admin_id_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.deletedSubscriptions, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.deletedSubscriptions, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
