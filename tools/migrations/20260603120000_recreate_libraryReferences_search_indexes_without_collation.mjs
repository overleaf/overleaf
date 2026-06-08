import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const oldIndexes = [
  {
    key: { userId: 1, searchKey: 1 },
    name: 'userId_1_searchKey_1',
    collation: { locale: 'en', strength: 1 },
  },
  {
    key: { userId: 1, 'fields.searchValue': 1, 'fields.name': 1 },
    name: 'userId_1_fields.searchValue_1_fields.name_1',
    collation: { locale: 'en', strength: 1 },
  },
]

const newIndexes = [
  {
    key: { userId: 1, searchKey: 1 },
    name: 'userId_1_searchKey_1',
  },
  {
    key: { userId: 1, 'fields.searchValue': 1, 'fields.name': 1 },
    name: 'userId_1_fields.searchValue_1_fields.name_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.libraryReferences, oldIndexes)
  await Helpers.addIndexesToCollection(db.libraryReferences, newIndexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.libraryReferences, newIndexes)
  await Helpers.addIndexesToCollection(db.libraryReferences, oldIndexes)
}

export default {
  tags,
  migrate,
  rollback,
}
