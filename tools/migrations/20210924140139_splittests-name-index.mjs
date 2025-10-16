import Helpers from './lib/helpers.mjs'
import mongodb from './lib/mongodb.mjs'
const { getCollectionInternal } = mongodb

const tags = ['saas']

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

const migrate = async client => {
  const collection = await getCollection()
  await Helpers.addIndexesToCollection(collection, indexes)
}

const rollback = async client => {
  const collection = await getCollection()
  await Helpers.dropIndexesFromCollection(collection, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
