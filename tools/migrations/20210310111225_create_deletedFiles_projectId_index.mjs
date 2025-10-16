import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      projectId: 1,
    },
    name: 'projectId_1',
  },
]

async function getCollection() {
  // NOTE: The deletedFiles collection is not available to the application as it has been retired. Fetch it here.
  return await getCollectionInternal('deletedFiles')
}

const migrate = async () => {
  await Helpers.addIndexesToCollection(await getCollection(), indexes)
}

const rollback = async () => {
  await Helpers.dropIndexesFromCollection(await getCollection(), indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
