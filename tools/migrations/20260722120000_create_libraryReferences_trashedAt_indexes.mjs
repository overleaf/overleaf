import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'auxiliary']

// Two partial indexes (docs without trashedAt are not indexed) supporting the
// soft-delete (trash) feature
//   - userId_1_trashedAt_1__id_1 serves the per-user trash listing/search,
//   - trashedAt_1 serves the daily expiry cron's cross-user scan.
const newIndexes = [
  {
    key: { userId: 1, trashedAt: 1, _id: 1 },
    name: 'userId_1_trashedAt_1__id_1',
    partialFilterExpression: { trashedAt: { $exists: true } },
  },
  {
    key: { trashedAt: 1 },
    name: 'trashedAt_1',
    partialFilterExpression: { trashedAt: { $exists: true } },
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
