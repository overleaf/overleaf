/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import mongodb from './lib/mongodb.mjs'
const { getCollectionInternal } = mongodb

const tags = ['server-pro', 'saas']

const indexes = [
  {
    unique: true,
    key: {
      project_id: 1,
    },
    name: 'project_id_1',
  },
  {
    key: {
      user_id: 1,
    },
    name: 'user_id_1',
  },
  {
    key: {
      name: 1,
    },
    name: 'name_1',
  },
]

async function getCollection() {
  // NOTE: This is a stale collection, it will get dropped in a later migration.
  return await getCollectionInternal('templates')
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
