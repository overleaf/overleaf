const { ReadPreference, ObjectId } = require('mongodb')
const { db, waitForDb } = require('../../app/src/infrastructure/mongodb')

const BATCH_DESCENDING = process.env.BATCH_DESCENDING === 'true'
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1000
let BATCH_LAST_ID
if (process.env.BATCH_LAST_ID) {
  BATCH_LAST_ID = ObjectId(process.env.BATCH_LAST_ID)
} else if (process.env.BATCH_RANGE_START) {
  BATCH_LAST_ID = ObjectId(process.env.BATCH_RANGE_START)
}
let BATCH_RANGE_END
if (process.env.BATCH_RANGE_END) {
  BATCH_RANGE_END = ObjectId(process.env.BATCH_RANGE_END)
}

async function getNextBatch(collection, query, maxId, projection, options) {
  const queryIdField = {}
  maxId = maxId || BATCH_LAST_ID
  if (maxId) {
    if (BATCH_DESCENDING) {
      queryIdField.$lt = maxId
    } else {
      queryIdField.$gt = maxId
    }
  }
  if (BATCH_RANGE_END) {
    if (BATCH_DESCENDING) {
      queryIdField.$gt = BATCH_RANGE_END
    } else {
      queryIdField.$lt = BATCH_RANGE_END
    }
  }
  if (queryIdField.$gt || queryIdField.$lt) {
    query._id = queryIdField
  }
  const entries = await collection
    .find(query, options)
    .project(projection)
    .sort({ _id: BATCH_DESCENDING ? -1 : 1 })
    .limit(BATCH_SIZE)
    .toArray()
  return entries
}

async function performUpdate(collection, nextBatch, update) {
  return collection.updateMany(
    { _id: { $in: nextBatch.map(entry => entry._id) } },
    update
  )
}

async function batchedUpdate(
  collectionName,
  query,
  update,
  projection,
  options
) {
  await waitForDb()
  const collection = db[collectionName]

  options = options || {}
  options.readPreference = ReadPreference.SECONDARY

  projection = projection || { _id: 1 }
  let nextBatch
  let updated = 0
  let maxId
  while (
    (nextBatch = await getNextBatch(
      collection,
      query,
      maxId,
      projection,
      options
    )).length
  ) {
    maxId = nextBatch[nextBatch.length - 1]._id
    updated += nextBatch.length
    console.log(
      `Running update on batch with ids ${JSON.stringify(
        nextBatch.map(entry => entry._id)
      )}`
    )

    if (typeof update === 'function') {
      await update(collection, nextBatch)
    } else {
      await performUpdate(collection, nextBatch, update)
    }

    console.error(`Completed batch ending ${maxId}`)
  }
  return updated
}

function batchedUpdateWithResultHandling(
  collection,
  query,
  update,
  projection,
  options
) {
  batchedUpdate(collection, query, update, projection, options)
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
  getNextBatch,
  batchedUpdate,
  batchedUpdateWithResultHandling,
}
