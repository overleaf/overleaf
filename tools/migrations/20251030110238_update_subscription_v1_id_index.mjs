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
    name: 'v1_id_3',
    unique: true,
    sparse: true,
  },
]
const tempIndex = [
  {
    key: { v1_id: 1 },
    name: 'v1_id_temp_migration',
    sparse: false, // Non-sparse so it includes null/missing values
  },
]

async function removeNullV1Ids(collection) {
  // Remove the v1_id field from documents where it's null
  const result = await collection.updateMany(
    { v1_id: { $type: 'null' } },
    { $unset: { v1_id: 1 } }
  )

  console.log(
    `Removed \`{ v1_id: null }\` field from ${result.modifiedCount} documents`
  )
}

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

  // Create temporary non-sparse index to allow queries with notablescan enabled
  await Helpers.addIndexesToCollection(db.subscriptions, tempIndex)

  // pre‑check (keep old index intact if failing)
  try {
    await assertNoDuplicateV1Ids(db.subscriptions)
    await removeNullV1Ids(db.subscriptions)
  } catch (error) {
    await Helpers.dropIndexesFromCollection(tempIndex)
    throw error
  }
  await Helpers.addIndexesToCollection(db.subscriptions, newIndexes)
  await Helpers.dropIndexesFromCollection(
    db.subscriptions,
    originalIndexes.concat({ name: 'v1_id_2' }).concat(tempIndex)
  )
}

const rollback = async client => {
  const { db } = client

  // recreate the original non-unique sparse index
  await Helpers.addIndexesToCollection(db.subscriptions, originalIndexes)
  await Helpers.dropIndexesFromCollection(db.subscriptions, newIndexes)
}

export default {
  tags,
  migrate,
  rollback,
}
