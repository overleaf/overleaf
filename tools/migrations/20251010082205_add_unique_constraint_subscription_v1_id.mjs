import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const originalIndexes = [
  {
    key: { v1_id: 1 },
    name: 'v1_id_1',
    sparse: true,
  },
]
const newIndexes = [
  {
    key: { v1_id: 1 },
    name: 'v1_id_2',
    unique: true,
    partialFilterExpression: {
      v1_id: { $type: 'number' },
    },
  },
]

async function assertNoDuplicateV1Ids(collection) {
  const duplicates = await collection
    .aggregate([
      { $match: { v1_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$v1_id',
          count: { $sum: 1 },
          docs: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray()

  if (duplicates.length > 0) {
    const duplicateDetails = duplicates.map(dup => ({
      v1_id: dup._id,
      count: dup.count,
      docs: dup.docs,
    }))
    throw new Error(
      `Duplicate v1_id values found. Migration aborted to prevent data loss. Details: ${JSON.stringify(
        duplicateDetails,
        null,
        2
      )}`
    )
  }
}

const migrate = async client => {
  const { db } = client

  // pre‑check (keep old index intact if failing)
  await assertNoDuplicateV1Ids(db.subscriptions)
  await Helpers.dropIndexesFromCollection(db.subscriptions, originalIndexes)
  await Helpers.addIndexesToCollection(db.subscriptions, newIndexes)
}

const rollback = async client => {
  const { db } = client

  await Helpers.dropIndexesFromCollection(db.subscriptions, newIndexes)
  // recreate the original non-unique sparse index
  await Helpers.addIndexesToCollection(db.subscriptions, originalIndexes)
}

export default {
  tags,
  migrate,
  rollback,
}
