import Helpers from './lib/helpers.mjs'

const tags = ['saas']

// Partial indexes so docs without a given match token are not indexed. They
// back the batch duplicate-detection query in findMatchingReferences.
const newIndexes = [
  {
    key: { userId: 1, 'matchTokens.doi': 1 },
    name: 'userId_1_matchTokens.doi_1',
    partialFilterExpression: { 'matchTokens.doi': { $exists: true } },
  },
  {
    key: { userId: 1, 'matchTokens.authorTitleYear': 1 },
    name: 'userId_1_matchTokens.authorTitleYear_1',
    partialFilterExpression: {
      'matchTokens.authorTitleYear': { $exists: true },
    },
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
