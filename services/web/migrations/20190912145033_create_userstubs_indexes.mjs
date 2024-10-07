/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import mongodb from '../app/src/infrastructure/mongodb.js'
const { getCollectionInternal } = mongodb

const tags = ['saas']

const indexes = [
  {
    key: {
      'overleaf.id': 1,
    },
    name: 'overleaf.id_1',
  },
]

async function getCollection() {
  // NOTE: This is a stale collection, it will get dropped in a later migration.
  return await getCollectionInternal('userstubs')
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
}
