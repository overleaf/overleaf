// @ts-check
/**
 * Mongo backend for the blob store.
 *
 * Blobs are stored in the projectHistoryBlobs collection. Each project has a
 * document in that collection. That document has a "blobs" subdocument whose
 * fields are buckets of blobs. The key of a bucket is the first three hex
 * digits of the blob hash. The value of the bucket is an array of blobs that
 * match the key.
 *
 * Buckets have a maximum capacity of 8 blobs. When that capacity is exceeded,
 * blobs are stored in a secondary collection: the projectHistoryShardedBlobs
 * collection. This collection shards blobs between 16 documents per project.
 * The shard key is the first hex digit of the hash. The documents are also
 * organized in buckets, but the bucket key is made of hex digits 2, 3 and 4.
 */

const { Blob } = require('overleaf-editor-core')
const { ObjectId, Binary, MongoError, ReadPreference } = require('mongodb')
const assert = require('../assert')
const mongodb = require('../mongodb')

const MAX_BLOBS_IN_BUCKET = 8
const DUPLICATE_KEY_ERROR_CODE = 11000

/**
 * @typedef {import('mongodb').ReadPreferenceLike} ReadPreferenceLike
 */

/**
 * Set up the data structures for a given project.
 * @param {string} projectId
 */
async function initialize(projectId) {
  assert.mongoId(projectId, 'bad projectId')
  try {
    await mongodb.blobs.insertOne({
      _id: new ObjectId(projectId),
      blobs: {},
    })
  } catch (err) {
    if (err instanceof MongoError && err.code === DUPLICATE_KEY_ERROR_CODE) {
      return // ignore already initialized case
    }
    throw err
  }
}

/**
 * Return blob metadata for the given project and hash.
 * @param {string} projectId
 * @param {string} hash
 * @return {Promise<Blob | null>}
 */
async function findBlob(projectId, hash) {
  assert.mongoId(projectId, 'bad projectId')
  assert.blobHash(hash, 'bad hash')

  const bucket = getBucket(hash)
  const result = await mongodb.blobs.findOne(
    { _id: new ObjectId(projectId) },
    { projection: { _id: 0, bucket: `$${bucket}` } }
  )

  if (result?.bucket == null) {
    return null
  }

  const record = result.bucket.find(blob => blob.h.toString('hex') === hash)
  if (record == null) {
    if (result.bucket.length >= MAX_BLOBS_IN_BUCKET) {
      return await findBlobSharded(projectId, hash)
    } else {
      return null
    }
  }
  return recordToBlob(record)
}

/**
 * Search in the sharded collection for blob metadata
 * @param {string} projectId
 * @param {string} hash
 * @return {Promise<Blob | null>}
 */
async function findBlobSharded(projectId, hash) {
  const [shard, bucket] = getShardedBucket(hash)
  const id = makeShardedId(projectId, shard)
  const result = await mongodb.shardedBlobs.findOne(
    { _id: id },
    { projection: { _id: 0, blobs: `$${bucket}` } }
  )
  if (result?.blobs == null) {
    return null
  }
  const record = result.blobs.find(blob => blob.h.toString('hex') === hash)
  if (!record) return null
  return recordToBlob(record)
}

/**
 * Read multiple blob metadata records by hexadecimal hashes.
 * @param {string} projectId
 * @param {Array<string>} hashes
 * @return {Promise<Array<Blob>>}
 */
async function findBlobs(projectId, hashes) {
  assert.mongoId(projectId, 'bad projectId')
  assert.array(hashes, 'bad hashes: not array')
  hashes.forEach(function (hash) {
    assert.blobHash(hash, 'bad hash')
  })

  // Build a set of unique buckets
  const buckets = new Set(hashes.map(getBucket))

  // Get buckets from Mongo
  const projection = { _id: 0 }
  for (const bucket of buckets) {
    projection[bucket] = 1
  }
  const result = await mongodb.blobs.findOne(
    { _id: new ObjectId(projectId) },
    { projection }
  )

  if (result?.blobs == null) {
    return []
  }

  // Build blobs from the query results
  const hashSet = new Set(hashes)
  const blobs = []
  for (const bucket of Object.values(result.blobs)) {
    for (const record of bucket) {
      const hash = record.h.toString('hex')
      if (hashSet.has(hash)) {
        blobs.push(recordToBlob(record))
        hashSet.delete(hash)
      }
    }
  }

  // If we haven't found all the blobs, look in the sharded collection
  if (hashSet.size > 0) {
    const shardedBlobs = await findBlobsSharded(projectId, hashSet)
    blobs.push(...shardedBlobs)
  }

  return blobs
}

/**
 * Search in the sharded collection for blob metadata.
 * @param {string} projectId
 * @param {Set<string>} hashSet
 * @return {Promise<Array<Blob>>}
 */
async function findBlobsSharded(projectId, hashSet) {
  // Build a map of buckets by shard key
  const bucketsByShard = new Map()
  for (const hash of hashSet) {
    const [shard, bucket] = getShardedBucket(hash)
    let buckets = bucketsByShard.get(shard)
    if (buckets == null) {
      buckets = new Set()
      bucketsByShard.set(shard, buckets)
    }
    buckets.add(bucket)
  }

  // Make parallel requests to the shards that might contain the hashes we want
  const requests = []
  for (const [shard, buckets] of bucketsByShard.entries()) {
    const id = makeShardedId(projectId, shard)
    const projection = { _id: 0 }
    for (const bucket of buckets) {
      projection[bucket] = 1
    }
    const request = mongodb.shardedBlobs.findOne({ _id: id }, { projection })
    requests.push(request)
  }
  const results = await Promise.all(requests)

  // Build blobs from the query results
  const blobs = []
  for (const result of results) {
    if (result?.blobs == null) {
      continue
    }

    for (const bucket of Object.values(result.blobs)) {
      for (const record of bucket) {
        const hash = record.h.toString('hex')
        if (hashSet.has(hash)) {
          blobs.push(recordToBlob(record))
        }
      }
    }
  }
  return blobs
}

/**
 * Return metadata for all blobs in the given project
 */
async function getProjectBlobs(projectId) {
  assert.mongoId(projectId, 'bad projectId')

  const result = await mongodb.blobs.findOne(
    { _id: new ObjectId(projectId) },
    { projection: { _id: 0 } }
  )

  if (!result) {
    return []
  }

  // Build blobs from the query results
  const blobs = []
  for (const bucket of Object.values(result.blobs)) {
    for (const record of bucket) {
      blobs.push(recordToBlob(record))
    }
  }

  // Look for all possible sharded blobs

  const minShardedId = makeShardedId(projectId, '0')
  const maxShardedId = makeShardedId(projectId, 'f')
  // @ts-ignore We are using a custom _id here.
  const shardedRecords = mongodb.shardedBlobs.find(
    {
      _id: { $gte: minShardedId, $lte: maxShardedId },
    },
    { projection: { _id: 0 } }
  )

  for await (const shardedRecord of shardedRecords) {
    if (shardedRecord.blobs == null) {
      continue
    }
    for (const bucket of Object.values(shardedRecord.blobs)) {
      for (const record of bucket) {
        blobs.push(recordToBlob(record))
      }
    }
  }

  return blobs
}

/**
 * Return metadata for all blobs in the given project
 * @param {Array<string>} projectIds
 * @return {Promise<{ nBlobs: number, blobs: Map<string, Array<Blob>> }>}
 */
async function getProjectBlobsBatch(projectIds) {
  for (const project of projectIds) {
    assert.mongoId(project, 'bad projectId')
  }
  let nBlobs = 0
  const blobs = new Map()
  if (projectIds.length === 0) return { nBlobs, blobs }

  // blobs
  {
    const cursor = await mongodb.blobs.find(
      { _id: { $in: projectIds.map(projectId => new ObjectId(projectId)) } },
      { readPreference: ReadPreference.secondaryPreferred }
    )
    for await (const record of cursor) {
      const projectBlobs = Object.values(record.blobs).flat().map(recordToBlob)
      blobs.set(record._id.toString(), projectBlobs)
      nBlobs += projectBlobs.length
    }
  }

  // sharded blobs
  {
    // @ts-ignore We are using a custom _id here.
    const cursor = await mongodb.shardedBlobs.find(
      {
        _id: {
          $gte: makeShardedId(projectIds[0], '0'),
          $lte: makeShardedId(projectIds[projectIds.length - 1], 'f'),
        },
      },
      { readPreference: ReadPreference.secondaryPreferred }
    )
    for await (const record of cursor) {
      const recordIdHex = record._id.toString('hex')
      const recordProjectId = recordIdHex.slice(0, 24)
      const projectBlobs = Object.values(record.blobs).flat().map(recordToBlob)
      const found = blobs.get(recordProjectId)
      if (found) {
        found.push(...projectBlobs)
      } else {
        blobs.set(recordProjectId, projectBlobs)
      }
      nBlobs += projectBlobs.length
    }
  }
  return { nBlobs, blobs }
}

/**
 * Add a blob's metadata to the blobs collection after it has been uploaded.
 * @param {string} projectId
 * @param {Blob} blob
 */
async function insertBlob(projectId, blob) {
  assert.mongoId(projectId, 'bad projectId')
  const hash = blob.getHash()
  const bucket = getBucket(hash)
  const record = blobToRecord(blob)
  const result = await mongodb.blobs.updateOne(
    {
      _id: new ObjectId(projectId),
      $expr: {
        $lt: [{ $size: { $ifNull: [`$${bucket}`, []] } }, MAX_BLOBS_IN_BUCKET],
      },
    },
    {
      $addToSet: { [bucket]: record },
    }
  )

  if (result.matchedCount === 0) {
    await insertRecordSharded(projectId, hash, record)
  }
}

/**
 * Add a blob's metadata to the sharded blobs collection.
 * @param {string} projectId
 * @param {string} hash
 * @param {Record} record
 * @return {Promise<void>}
 */
async function insertRecordSharded(projectId, hash, record) {
  const [shard, bucket] = getShardedBucket(hash)
  const id = makeShardedId(projectId, shard)
  await mongodb.shardedBlobs.updateOne(
    { _id: id },
    { $addToSet: { [bucket]: record } },
    { upsert: true }
  )
}

/**
 * Delete all blobs for a given project.
 * @param {string} projectId
 */
async function deleteBlobs(projectId) {
  assert.mongoId(projectId, 'bad projectId')
  await mongodb.blobs.deleteOne({ _id: new ObjectId(projectId) })
  const minShardedId = makeShardedId(projectId, '0')
  const maxShardedId = makeShardedId(projectId, 'f')
  await mongodb.shardedBlobs.deleteMany({
    // @ts-ignore We are using a custom _id here.
    _id: { $gte: minShardedId, $lte: maxShardedId },
  })
}

/**
 * Return the Mongo path to the bucket for the given hash.
 * @param {string} hash
 * @return {string}
 */
function getBucket(hash) {
  return `blobs.${hash.slice(0, 3)}`
}

/**
 * Return the shard key and Mongo path to the bucket for the given hash in the
 * sharded collection.
 * @param {string} hash
 * @return {[string, string]}
 */
function getShardedBucket(hash) {
  const shard = hash.slice(0, 1)
  const bucket = `blobs.${hash.slice(1, 4)}`
  return [shard, bucket]
}

/**
 * Create an _id key for the sharded collection.
 * @param {string} projectId
 * @param {string} shard
 * @return {Binary}
 */
function makeShardedId(projectId, shard) {
  return new Binary(Buffer.from(`${projectId}0${shard}`, 'hex'))
}

/**
 * @typedef {Object} Record
 * @property {Binary} h
 * @property {number} b
 * @property {number} [s]
 */

/**
 * Return the Mongo record for the given blob.
 * @param {Blob} blob
 * @return {Record}
 */
function blobToRecord(blob) {
  const hash = blob.getHash()
  const byteLength = blob.getByteLength()
  const stringLength = blob.getStringLength()
  return {
    h: new Binary(Buffer.from(hash, 'hex')),
    b: byteLength,
    s: stringLength,
  }
}

/**
 * Create a blob from the given Mongo record.
 * @param {Record} record
 * @return {Blob}
 */
function recordToBlob(record) {
  return new Blob(record.h.toString('hex'), record.b, record.s)
}

module.exports = {
  initialize,
  findBlob,
  findBlobs,
  getProjectBlobs,
  getProjectBlobsBatch,
  insertBlob,
  deleteBlobs,
}
