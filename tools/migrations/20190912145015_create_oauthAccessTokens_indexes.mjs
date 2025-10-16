/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexes = [
  {
    unique: true,
    key: {
      accessToken: 1,
    },
    name: 'accessToken_1',
  },
  {
    unique: true,
    key: {
      refreshToken: 1,
    },
    name: 'refreshToken_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.oauthAccessTokens, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
