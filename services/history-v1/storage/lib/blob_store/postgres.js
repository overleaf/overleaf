const { Blob } = require('overleaf-editor-core')
const assert = require('../assert')
const knex = require('../knex')

/**
 * Set up the initial data structures for a project
 */
async function initialize(projectId) {
  // Nothing to do for Postgres
}

/**
 * Return blob metadata for the given project and hash
 */
async function findBlob(projectId, hash) {
  assert.postgresId(projectId, 'bad projectId')
  projectId = parseInt(projectId, 10)
  assert.blobHash(hash, 'bad hash')

  const binaryHash = hashToBuffer(hash)
  const record = await knex('project_blobs')
    .select('hash_bytes', 'byte_length', 'string_length')
    .where({
      project_id: projectId,
      hash_bytes: binaryHash,
    })
    .first()
  return recordToBlob(record)
}

/**
 * Read multiple blob metadata records by hexadecimal hashes.
 *
 * @param {Array.<string>} hashes hexadecimal SHA-1 hashes
 * @return {Promise.<Array.<Blob?>>} no guarantee on order
 */
async function findBlobs(projectId, hashes) {
  assert.postgresId(projectId, 'bad projectId')
  projectId = parseInt(projectId, 10)
  assert.array(hashes, 'bad hashes: not array')
  hashes.forEach(function (hash) {
    assert.blobHash(hash, 'bad hash')
  })

  const binaryHashes = hashes.map(hashToBuffer)

  const records = await knex('project_blobs')
    .select('hash_bytes', 'byte_length', 'string_length')
    .where('project_id', projectId)
    .whereIn('hash_bytes', binaryHashes)

  const blobs = records.map(recordToBlob)
  return blobs
}

/**
 * Return metadata for all blobs in the given project
 */
async function getProjectBlobs(projectId) {
  assert.postgresId(projectId, 'bad projectId')
  projectId = parseInt(projectId, 10)

  const records = await knex('project_blobs')
    .select('hash_bytes', 'byte_length', 'string_length')
    .where({
      project_id: projectId,
    })

  const blobs = records.map(recordToBlob)
  return blobs
}

/**
 * Return metadata for all blobs in the given project
 * @param {Array<number>} projectIds
 * @return {Promise<{ nBlobs: number, blobs: Map<number, Array<Blob>> }>}
 */
async function getProjectBlobsBatch(projectIds) {
  for (const projectId of projectIds) {
    assert.integer(projectId, 'bad projectId')
  }
  let nBlobs = 0
  const blobs = new Map()
  if (projectIds.length === 0) return { nBlobs, blobs }

  const cursor = knex('project_blobs')
    .select('project_id', 'hash_bytes', 'byte_length', 'string_length')
    .whereIn('project_id', projectIds)
    .stream()
  for await (const record of cursor) {
    const found = blobs.get(record.project_id)
    if (found) {
      found.push(recordToBlob(record))
    } else {
      blobs.set(record.project_id, [recordToBlob(record)])
    }
    nBlobs++
  }
  return { nBlobs, blobs }
}

/**
 * Add a blob's metadata to the blobs table after it has been uploaded.
 */
async function insertBlob(projectId, blob) {
  assert.postgresId(projectId, 'bad projectId')
  projectId = parseInt(projectId, 10)

  await knex('project_blobs')
    .insert(blobToRecord(projectId, blob))
    .onConflict(['project_id', 'hash_bytes'])
    .ignore()
}

/**
 * Deletes all blobs for a given project
 */
async function deleteBlobs(projectId) {
  assert.postgresId(projectId, 'bad projectId')
  projectId = parseInt(projectId, 10)

  await knex('project_blobs').where('project_id', projectId).delete()
}

function blobToRecord(projectId, blob) {
  return {
    project_id: projectId,
    hash_bytes: hashToBuffer(blob.hash),
    byte_length: blob.getByteLength(),
    string_length: blob.getStringLength(),
  }
}

function recordToBlob(record) {
  if (!record) return
  return new Blob(
    hashFromBuffer(record.hash_bytes),
    record.byte_length,
    record.string_length
  )
}

function hashToBuffer(hash) {
  if (!hash) return
  return Buffer.from(hash, 'hex')
}

function hashFromBuffer(buffer) {
  if (!buffer) return
  return buffer.toString('hex')
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
