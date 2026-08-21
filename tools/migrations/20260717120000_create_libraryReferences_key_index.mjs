import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'auxiliary']

// Backs an exact/prefix-range lookup on the raw citation key, used to suggest
// a unique citation key when auto-generating one from author/year.
const newIndexes = [
  {
    key: { userId: 1, key: 1 },
    name: 'userId_1_key_1',
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
