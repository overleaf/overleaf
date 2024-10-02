/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import mongodb from '../app/src/infrastructure/mongodb.js'
const { getCollectionInternal } = mongodb

const tags = ['saas']

const indexes = [
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
  {
    // expire after 30 days
    expireAfterSeconds: 60 * 60 * 24 * 30,
    key: {
      createdAt: 1,
    },
    name: 'createdAt_1',
  },
]

// Export indexes for use in the fix-up migration 20220105130000_fix_saml_indexes.js.
const samlLogsIndexes = indexes

async function getCollection() {
  // This collection was incorrectly named - it should have been `samlLogs`
  //  instead of `samllog`. The error is corrected by the subsequent migration
  //  20220105130000_fix_saml_indexes.js.
  return await getCollectionInternal('samllog')
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
  samlLogsIndexes,
}
