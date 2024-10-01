/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    unique: true,
    key: {
      token: 1,
      use: 1,
    },
    name: 'token_1_use_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.tokens, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.tokens, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
