/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import mongodb from '../app/src/infrastructure/mongodb.js'
const { getCollectionInternal } = mongodb

const tags = ['saas']

const indexes = [
  {
    key: {
      'samlIdentifiers.externalUserId': 1,
      'samlIdentifiers.providerId': 1,
    },
    name: 'samlIdentifiers.externalUserId_1_samlIdentifiers.providerId_1',
    sparse: true,
  },
]

// Export indexes for use in the fix-up migration 20220105130000_fix_saml_indexes.js.
const usersIndexes = indexes

async function getCollection() {
  // This collection was incorrectly named - it should have been `users` instead
  //  of `user`. The error is corrected by the subsequent migration
  //  20220105130000_fix_saml_indexes.js.
  return await getCollectionInternal('user')
}

const migrate = async client => {
  const collection = await getCollection()
  await Helpers.addIndexesToCollection(collection, indexes)
}

const rollback = async client => {
  const collection = await getCollection()
  try {
    await Helpers.dropIndexesFromCollection(collection, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
  usersIndexes,
}
