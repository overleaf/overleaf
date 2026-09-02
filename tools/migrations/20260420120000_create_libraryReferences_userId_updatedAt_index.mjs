import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'auxiliary']

const indexes = [
  {
    key: { userId: 1, updatedAt: 1 },
    name: 'userId_1_updatedAt_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.libraryReferences, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.libraryReferences, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
