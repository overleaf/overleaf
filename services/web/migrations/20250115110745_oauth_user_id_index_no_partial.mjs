/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const oldIndex = {
  key: { user_id: 1 },
  name: 'pat_user_id_1',
  partialFilterExpression: { type: 'pat' },
}

const newIndex = {
  key: { user_id: 1 },
  name: 'user_id_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [newIndex])
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.addIndexesToCollection(db.oauthAccessTokens, [oldIndex])
    await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [newIndex])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
