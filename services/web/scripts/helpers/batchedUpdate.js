const { ReadPreference, ObjectId } = require('mongodb')
const { db, waitForDb } = require('../../app/src/infrastructure/mongodb')

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1000
let BATCH_LAST_ID
if (process.env.BATCH_LAST_ID) {
  BATCH_LAST_ID = ObjectId(process.env.BATCH_LAST_ID)
}

async function getNextBatch(collection, query, maxId, projection) {
  if (maxId) {
    query['_id'] = { $gt: maxId }
  }
  const entries = await collection
    .find(query)
    .project(projection)
    .sort({ _id: 1 })
    .limit(BATCH_SIZE)
    .setReadPreference(ReadPreference.SECONDARY)
    .toArray()
  return entries
}

async function performUpdate(collection, nextBatch, update) {
  return collection.updateMany(
    { _id: { $in: nextBatch.map(entry => entry._id) } },
    update
  )
}

async function batchedUpdate(collectionName, query, update, projection) {
  await waitForDb()
  const collection = db[collectionName]

  projection = projection || { _id: 1 }
  let nextBatch
  let updated = 0
  let maxId = BATCH_LAST_ID
  while (
    (nextBatch = await getNextBatch(collection, query, maxId, projection))
      .length
  ) {
    maxId = nextBatch[nextBatch.length - 1]._id
    updated += nextBatch.length
    console.log(JSON.stringify(nextBatch))

    if (typeof update === 'function') {
      await update(collection, nextBatch)
    } else {
      await performUpdate(collection, nextBatch, update)
    }
  }
  return updated
}

function batchedUpdateWithResultHandling(collection, query, update) {
  batchedUpdate(collection, query, update)
    .then(updated => {
      console.error({ updated })
      process.exit(0)
    })
    .catch(error => {
      console.error({ error })
      process.exit(1)
    })
}

module.exports = {
  batchedUpdate,
  batchedUpdateWithResultHandling
}
