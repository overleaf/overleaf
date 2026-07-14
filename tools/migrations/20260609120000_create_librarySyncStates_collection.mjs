import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'auxiliary']

const indexes = [
  {
    key: { userId: 1, provider: 1, libraryType: 1, libraryId: 1 },
    name: 'userId_1_provider_1_libraryType_1_libraryId_1',
    unique: true,
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.librarySyncStates, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.librarySyncStates, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
