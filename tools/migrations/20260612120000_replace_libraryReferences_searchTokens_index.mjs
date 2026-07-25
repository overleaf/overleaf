import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const newIndexes = [
  {
    key: { userId: 1, searchTokens: 1 },
    name: 'userId_1_searchTokens_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.libraryReferences, newIndexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.libraryReferences, newIndexes)
}

export default {
  tags,
  migrate,
  rollback,
}
