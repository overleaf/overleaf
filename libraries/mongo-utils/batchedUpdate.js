// @ts-check
/* eslint-disable no-console */
const { ObjectId, ReadPreference } = require('mongodb')

const READ_PREFERENCE_SECONDARY =
  process.env.MONGO_HAS_SECONDARIES === 'true'
    ? ReadPreference.secondary.mode
    : ReadPreference.secondaryPreferred.mode

const ONE_MONTH_IN_MS = 1000 * 60 * 60 * 24 * 31
let ID_EDGE_PAST
const ID_EDGE_FUTURE = objectIdFromMs(Date.now() + 1000)
let BATCH_DESCENDING
let BATCH_SIZE
let VERBOSE_LOGGING
let BATCH_RANGE_START
let BATCH_RANGE_END
let BATCH_MAX_TIME_SPAN_IN_MS
let BATCHED_UPDATE_RUNNING = false

/**
 * @typedef {import("mongodb").Collection} Collection
 * @typedef {import("mongodb-legacy").Collection} LegacyCollection
 * @typedef {import("mongodb").Document} Document
 * @typedef {import("mongodb").FindOptions} FindOptions
 * @typedef {import("mongodb").UpdateFilter<Document>} UpdateDocument
 */

/**
 * @typedef {Object} BatchedUpdateOptions
 * @property {string} [BATCH_DESCENDING]
 * @property {string} [BATCH_LAST_ID]
 * @property {string} [BATCH_MAX_TIME_SPAN_IN_MS]
 * @property {string} [BATCH_RANGE_END]
 * @property {string} [BATCH_RANGE_START]
 * @property {string} [BATCH_SIZE]
 * @property {string} [VERBOSE_LOGGING]
 * @property {(progress: string) => Promise<void>} [trackProgress]
 */

/**
 * @param {BatchedUpdateOptions} options
 */
function refreshGlobalOptionsForBatchedUpdate(options = {}) {
  options = Object.assign({}, options, process.env)

  BATCH_DESCENDING = options.BATCH_DESCENDING === 'true'
  BATCH_SIZE = parseInt(options.BATCH_SIZE || '1000', 10) || 1000
  VERBOSE_LOGGING = options.VERBOSE_LOGGING === 'true'
  if (options.BATCH_LAST_ID) {
    BATCH_RANGE_START = objectIdFromInput(options.BATCH_LAST_ID)
  } else if (options.BATCH_RANGE_START) {
    BATCH_RANGE_START = objectIdFromInput(options.BATCH_RANGE_START)
  } else {
    if (BATCH_DESCENDING) {
      BATCH_RANGE_START = ID_EDGE_FUTURE
    } else {
      BATCH_RANGE_START = ID_EDGE_PAST
    }
  }
  BATCH_MAX_TIME_SPAN_IN_MS = parseInt(
    options.BATCH_MAX_TIME_SPAN_IN_MS || ONE_MONTH_IN_MS.toString(),
    10
  )
  if (options.BATCH_RANGE_END) {
    BATCH_RANGE_END = objectIdFromInput(options.BATCH_RANGE_END)
  } else {
    if (BATCH_DESCENDING) {
      BATCH_RANGE_END = ID_EDGE_PAST
    } else {
      BATCH_RANGE_END = ID_EDGE_FUTURE
    }
  }
}

/**
 * @param {Collection | LegacyCollection} collection
 * @param {Document} query
 * @param {ObjectId} start
 * @param {ObjectId} end
 * @param {Document} projection
 * @param {FindOptions} findOptions
 * @return {Promise<Array<Document>>}
 */
async function getNextBatch(
  collection,
  query,
  start,
  end,
  projection,
  findOptions
) {
  if (BATCH_DESCENDING) {
    query._id = {
      $gt: end,
      $lte: start,
    }
  } else {
    query._id = {
      $gt: start,
      $lte: end,
    }
  }
  return await collection
    .find(query, findOptions)
    .project(projection)
    .sort({ _id: BATCH_DESCENDING ? -1 : 1 })
    .limit(BATCH_SIZE)
    .toArray()
}

/**
 * @param {Collection | LegacyCollection} collection
 * @param {Array<Document>} nextBatch
 * @param {UpdateDocument} update
 * @return {Promise<void>}
 */
async function performUpdate(collection, nextBatch, update) {
  await collection.updateMany(
    { _id: { $in: nextBatch.map(entry => entry._id) } },
    update
  )
}

/**
 * @param {string} input
 * @return {ObjectId}
 */
function objectIdFromInput(input) {
  if (input.includes('T')) {
    const t = new Date(input).getTime()
    if (Number.isNaN(t)) throw new Error(`${input} is not a valid date`)
    return objectIdFromMs(t)
  } else {
    return new ObjectId(input)
  }
}

/**
 * @param {ObjectId} objectId
 * @return {string}
 */
function renderObjectId(objectId) {
  return `${objectId} (${objectId.getTimestamp().toISOString()})`
}

/**
 * @param {number} ms
 * @return {ObjectId}
 */
function objectIdFromMs(ms) {
  return ObjectId.createFromTime(ms / 1000)
}

/**
 * @param {ObjectId} id
 * @return {number}
 */
function getMsFromObjectId(id) {
  return id.getTimestamp().getTime()
}

/**
 * @param {ObjectId} start
 * @return {ObjectId}
 */
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

/**
 * @param {Collection | LegacyCollection} collection
 * @return {Promise<ObjectId|null>}
 */
async function getIdEdgePast(collection) {
  const [first] = await collection
    .find({})
    .project({ _id: 1 })
    .sort({ _id: 1 })
    .limit(1)
    .toArray()
  if (!first) return null
  // Go one second further into the past in order to include the first entry via
  // first._id > ID_EDGE_PAST
  return objectIdFromMs(Math.max(0, getMsFromObjectId(first._id) - 1000))
}

/**
 * @param {Collection | LegacyCollection} collection
 * @param {Document} query
 * @param {UpdateDocument | ((batch: Array<Document>) => Promise<void>)} update
 * @param {Document} [projection]
 * @param {FindOptions} [findOptions]
 * @param {BatchedUpdateOptions} [batchedUpdateOptions]
 */
async function batchedUpdate(
  collection,
  query,
  update,
  projection,
  findOptions,
  batchedUpdateOptions = {}
) {
  // only a single batchedUpdate can run at a time due to global variables
  if (BATCHED_UPDATE_RUNNING) {
    throw new Error('batchedUpdate is already running')
  }
  try {
    BATCHED_UPDATE_RUNNING = true
    ID_EDGE_PAST = await getIdEdgePast(collection)
    if (!ID_EDGE_PAST) {
      console.warn(
        `The collection ${collection.collectionName} appears to be empty.`
      )
      return 0
    }
    refreshGlobalOptionsForBatchedUpdate(batchedUpdateOptions)
    const { trackProgress = async progress => console.warn(progress) } =
      batchedUpdateOptions

    findOptions = findOptions || {}
    findOptions.readPreference = READ_PREFERENCE_SECONDARY

    projection = projection || { _id: 1 }
    let nextBatch
    let updated = 0
    let start = BATCH_RANGE_START

    while (start !== BATCH_RANGE_END) {
      let end = getNextEnd(start)
      nextBatch = await getNextBatch(
        collection,
        query,
        start,
        end,
        projection,
        findOptions
      )
      if (nextBatch.length > 0) {
        end = nextBatch[nextBatch.length - 1]._id
        updated += nextBatch.length

        if (VERBOSE_LOGGING) {
          console.log(
            `Running update on batch with ids ${JSON.stringify(
              nextBatch.map(entry => entry._id)
            )}`
          )
        }
        await trackProgress(
          `Running update on batch ending ${renderObjectId(end)}`
        )

        if (typeof update === 'function') {
          await update(nextBatch)
        } else {
          await performUpdate(collection, nextBatch, update)
        }
      }
      await trackProgress(`Completed batch ending ${renderObjectId(end)}`)
      start = end
    }
    return updated
  } finally {
    BATCHED_UPDATE_RUNNING = false
  }
}

/**
 * @param {Collection | LegacyCollection} collection
 * @param {Document} query
 * @param {UpdateDocument | ((batch: Array<Object>) => Promise<void>)} update
 * @param {Document} [projection]
 * @param {FindOptions} [findOptions]
 * @param {BatchedUpdateOptions} [batchedUpdateOptions]
 */
function batchedUpdateWithResultHandling(
  collection,
  query,
  update,
  projection,
  findOptions,
  batchedUpdateOptions
) {
  batchedUpdate(
    collection,
    query,
    update,
    projection,
    findOptions,
    batchedUpdateOptions
  )
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
  READ_PREFERENCE_SECONDARY,
  objectIdFromInput,
  renderObjectId,
  batchedUpdate,
  batchedUpdateWithResultHandling,
}
