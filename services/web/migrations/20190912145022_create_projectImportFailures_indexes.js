/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')
const { getCollectionInternal } = require('../app/src/infrastructure/mongodb')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      v1_project_id: 1,
    },
    name: 'v1_project_id_1',
  },
]

async function getCollection() {
  // NOTE: This is a stale collection, it will get dropped in a later migration.
  return await getCollectionInternal('projectImportFailures')
}

exports.migrate = async client => {
  const collection = await getCollection()
  await Helpers.addIndexesToCollection(collection, indexes)
}

exports.rollback = async client => {
  const collection = await getCollection()
  try {
    await Helpers.dropIndexesFromCollection(collection, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
