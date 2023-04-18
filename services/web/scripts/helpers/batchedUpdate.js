const { ObjectId } = require('mongodb')
const {
  db,
  waitForDb,
  READ_PREFERENCE_SECONDARY,
} = require('../../app/src/infrastructure/mongodb')

const ONE_MONTH_IN_MS = 1000 * 60 * 60 * 24 * 31
let ID_EDGE_PAST
const ID_EDGE_FUTURE = objectIdFromMs(Date.now() + 1000)
let BATCH_DESCENDING
let BATCH_SIZE
let VERBOSE_LOGGING
let BATCH_RANGE_START
let BATCH_RANGE_END
let BATCH_MAX_TIME_SPAN_IN_MS

function refreshGlobalOptionsForBatchedUpdate(options = {}) {
  options = Object.assign({}, options, process.env)

  BATCH_DESCENDING = options.BATCH_DESCENDING === 'true'
  BATCH_SIZE = parseInt(options.BATCH_SIZE, 10) || 1000
  VERBOSE_LOGGING = options.VERBOSE_LOGGING === 'true'
  if (options.BATCH_LAST_ID) {
    BATCH_RANGE_START = ObjectId(options.BATCH_LAST_ID)
  } else if (options.BATCH_RANGE_START) {
    BATCH_RANGE_START = ObjectId(options.BATCH_RANGE_START)
  } else {
    if (BATCH_DESCENDING) {
      BATCH_RANGE_START = ID_EDGE_FUTURE
    } else {
      BATCH_RANGE_START = ID_EDGE_PAST
    }
  }
  BATCH_MAX_TIME_SPAN_IN_MS =
    parseInt(options.BATCH_MAX_TIME_SPAN_IN_MS, 10) || ONE_MONTH_IN_MS
  if (options.BATCH_RANGE_END) {
    BATCH_RANGE_END = ObjectId(options.BATCH_RANGE_END)
  } else {
    if (BATCH_DESCENDING) {
      BATCH_RANGE_END = ID_EDGE_PAST
    } else {
      BATCH_RANGE_END = ID_EDGE_FUTURE
    }
  }
}

async function getNextBatch({
  collection,
  query,
  start,
  end,
  projection,
  findOptions,
}) {
  if (BATCH_DESCENDING) {
    query._id = {
      $gt: end,
      $lt: start,
    }
  } else {
    query._id = {
      $gt: start,
      $lt: end,
    }
  }
  return await collection
    .find(query, findOptions)
    .project(projection)
    .sort({ _id: BATCH_DESCENDING ? -1 : 1 })
    .limit(BATCH_SIZE)
    .toArray()
}

async function performUpdate(collection, nextBatch, update) {
  return collection.updateMany(
    { _id: { $in: nextBatch.map(entry => entry._id) } },
    update
  )
}

function objectIdFromMs(ms) {
  return ObjectId.createFromTime(ms / 1000)
}

function getMsFromObjectId(id) {
  return id.getTimestamp().getTime()
}

function getNextEnd(start) {
  let end
  if (BATCH_DESCENDING) {
    end = objectIdFromMs(getMsFromObjectId(start) - BATCH_MAX_TIME_SPAN_IN_MS)
    if (getMsFromObjectId(end) <= getMsFromObjectId(BATCH_RANGE_END)) {
      end = BATCH_RANGE_END
    }
  } else {
    end = objectIdFromMs(getMsFromObjectId(start) + BATCH_MAX_TIME_SPAN_IN_MS)
    if (getMsFromObjectId(end) >= getMsFromObjectId(BATCH_RANGE_END)) {
      end = BATCH_RANGE_END
    }
  }
  return end
}

async function getIdEdgePast(collection) {
  const [first] = await collection
    .find({})
    .project({ _id: 1 })
    .limit(1)
    .toArray()
  if (!first) return null
  // Go 1s further into the past in order to include the first entry via
  // first._id > ID_EDGE_PAST
  return objectIdFromMs(Math.max(0, getMsFromObjectId(first._id) - 1000))
}

async function batchedUpdate(
  collectionName,
  query,
  update,
  projection,
  findOptions,
  batchedUpdateOptions
) {
  await waitForDb()
  const collection = db[collectionName]
  ID_EDGE_PAST = await getIdEdgePast(collection)
  if (!ID_EDGE_PAST) {
    console.warn(`The collection ${collectionName} appears to be empty.`)
    return 0
  }
  refreshGlobalOptionsForBatchedUpdate(batchedUpdateOptions)

  findOptions = findOptions || {}
  findOptions.readPreference = READ_PREFERENCE_SECONDARY

  projection = projection || { _id: 1 }
  let nextBatch
  let updated = 0
  let start = BATCH_RANGE_START

  while (start !== BATCH_RANGE_END) {
    let end = getNextEnd(start)
    nextBatch = await getNextBatch({
      collection,
      query,
      start,
      end,
      projection,
      findOptions,
    })
    if (nextBatch.length > 0) {
      end = nextBatch[nextBatch.length - 1]._id
      updated += nextBatch.length

      if (VERBOSE_LOGGING) {
        console.log(
          `Running update on batch with ids ${JSON.stringify(
            nextBatch.map(entry => entry._id)
          )}`
        )
      } else {
        console.error(`Running update on batch ending ${end}`)
      }

      if (typeof update === 'function') {
        await update(nextBatch)
      } else {
        await performUpdate(collection, nextBatch, update)
      }
    }
    console.error(`Completed batch ending ${end}`)
    start = end
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
    .then(processed => {
      console.error({ processed })
      process.exit(0)
    })
    .catch(error => {
      console.error({ error })
      process.exit(1)
    })
}

module.exports = {
  batchedUpdate,
  batchedUpdateWithResultHandling,
}
