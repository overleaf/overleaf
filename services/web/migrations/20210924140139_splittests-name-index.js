const Helpers = require('./lib/helpers')
const { getCollectionInternal } = require('../app/src/infrastructure/mongodb')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      name: 1,
    },
    unique: true,
    name: 'name_1',
  },
]

async function getCollection() {
  // NOTE: We do not access the splittests collection directly. Fetch it here.
  return await getCollectionInternal('splittests')
}

exports.migrate = async client => {
  const collection = await getCollection()
  await Helpers.addIndexesToCollection(collection, indexes)
}

exports.rollback = async client => {
  const collection = await getCollection()
  await Helpers.dropIndexesFromCollection(collection, indexes)
}
