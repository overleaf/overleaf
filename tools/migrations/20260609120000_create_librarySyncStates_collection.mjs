import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['saas']

const indexes = [
  {
    key: { userId: 1, provider: 1, libraryType: 1, libraryId: 1 },
    name: 'userId_1_provider_1_libraryType_1_libraryId_1',
    unique: true,
  },
]

const migrate = async () => {
  const librarySyncStates = await getCollectionInternal('librarySyncStates')
  await Helpers.addIndexesToCollection(librarySyncStates, indexes)
}

const rollback = async () => {
  const librarySyncStates = await getCollectionInternal('librarySyncStates')
  await Helpers.dropIndexesFromCollection(librarySyncStates, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
