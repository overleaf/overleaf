import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'auxiliary']

const oldIndexes = [
  {
    key: { userId: 1, 'fields.searchValue': 1, 'fields.name': 1 },
    name: 'userId_1_fields.searchValue_1_fields.name_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.libraryReferences, oldIndexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.libraryReferences, oldIndexes)
}

export default {
  tags,
  migrate,
  rollback,
}
