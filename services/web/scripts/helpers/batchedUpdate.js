const { ReadPreference } = require('mongodb')
const { getNativeDb } = require('../../app/src/infrastructure/Mongoose')

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1000

async function getNextBatch(collection, query, maxId) {
  if (maxId) {
    query['_id'] = { $gt: maxId }
  }
  const entries = await collection
    .find(query, { _id: 1 })
    .sort({ _id: 1 })
    .limit(BATCH_SIZE)
    .setReadPreference(ReadPreference.SECONDARY)
    .toArray()
  return entries.map(entry => entry._id)
}

async function performUpdate(collection, nextBatch, update) {
  return collection.updateMany({ _id: { $in: nextBatch } }, update)
}

async function batchedUpdate(collectionName, query, update) {
  const db = await getNativeDb()
  const collection = db.collection(collectionName)

  let nextBatch
  let updated = 0
  let maxId
  while ((nextBatch = await getNextBatch(collection, query, maxId)).length) {
    maxId = nextBatch[nextBatch.length - 1]
    updated += nextBatch.length
    console.log(JSON.stringify(nextBatch))
    await performUpdate(collection, nextBatch, update)
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
