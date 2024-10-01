/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    unique: true,
    key: {
      id: 1,
    },
    name: 'id_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.oauthApplications, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.oauthApplications, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
