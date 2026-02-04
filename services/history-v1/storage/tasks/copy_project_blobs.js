#!/usr/bin/env node

const { promisify } = require('node:util')
const BPromise = require('bluebird')
const commandLineArgs = require('command-line-args')
const config = require('config')
const fs = require('node:fs')
const readline = require('node:readline')
const { History } = require('overleaf-editor-core')
const { knex, historyStore, persistor } = require('..')
const projectKey = require('@overleaf/object-persistor/src/ProjectKey.js')

const MAX_POSTGRES_INTEGER = 2147483647
const DEFAULT_BATCH_SIZE = 1000
const MAX_RETRIES = 10
const RETRY_DELAY_MS = 5000

// Obtain a preconfigured GCS client through a non-documented property of
// object-persistor. Sorry about that. We need the GCS client because we use
// operations that are not implemented in object-persistor.
const gcsClient = persistor.storage
const globalBucket = gcsClient.bucket(config.get('blobStore.globalBucket'))
const projectBucket = gcsClient.bucket(config.get('blobStore.projectBucket'))
const delay = promisify(setTimeout)

async function main() {
  const options = commandLineArgs([
    { name: 'global-blobs', type: String },
    { name: 'min-project-id', type: Number, defaultValue: 1 },
    {
      name: 'max-project-id',
      type: Number,
      defaultValue: MAX_POSTGRES_INTEGER,
    },
    { name: 'batch-size', type: Number, defaultValue: DEFAULT_BATCH_SIZE },
    { name: 'concurrency', type: Number, defaultValue: 1 },
  ])
  if (!options['global-blobs']) {
    console.error(
      'You must specify a global blobs file with the --global-blobs option'
    )
    process.exit(1)
  }
  const globalBlobs = await readGlobalBlobs(options['global-blobs'])
  const minProjectId = options['min-project-id']
  const maxProjectId = options['max-project-id']
  const batchSize = options['batch-size']
  const concurrency = options.concurrency
  console.log(`Keeping ${globalBlobs.size} global blobs`)
  await run({ globalBlobs, minProjectId, maxProjectId, batchSize, concurrency })
  console.log('Done.')
}

async function readGlobalBlobs(filename) {
  const stream = fs.createReadStream(filename)
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  })
  const blobs = new Set()
  for await (const line of reader) {
    blobs.add(line.trim())
  }
  return blobs
}

async function run(options) {
  const { globalBlobs, minProjectId, maxProjectId, batchSize, concurrency } =
    options
  let batchStart = minProjectId
  while (batchStart <= maxProjectId) {
    let projectIds = await getProjectIds(batchStart, maxProjectId, batchSize)
    if (projectIds.length === 0) {
      break
    }
    const batchEnd = projectIds[projectIds.length - 1]
    console.log(`Processing projects ${batchStart} to ${batchEnd}`)
    const chunkIdsByProject = await getChunkIdsByProject(projectIds)

    let retries = 0
    while (true) {
      const results = await BPromise.map(
        projectIds,
        async projectId =>
          await processProject(
            projectId,
            chunkIdsByProject.get(projectId),
            globalBlobs
          ),
        { concurrency }
      )
      const failedProjectIds = results
        .filter(result => !result.success)
        .map(result => result.projectId)
      if (failedProjectIds.length === 0) {
        // All projects were copied successfully. Carry on.
        break
      }

      // Some projects failed. Retry.
      retries += 1
      if (retries > MAX_RETRIES) {
        console.log(
          `Too many retries processing projects ${batchStart} to ${batchEnd}. Giving up.`
        )
        process.exit(1)
      }
      console.log(`Retrying projects: ${failedProjectIds.join(', ')}`)
      await delay(RETRY_DELAY_MS)
      projectIds = failedProjectIds
    }

    // Set up next batch
    batchStart = batchEnd + 1
  }
}

async function getProjectIds(minProjectId, maxProjectId, batchSize) {
  const projectIds = await knex('chunks')
    .distinct('doc_id')
    .where('doc_id', '>=', minProjectId)
    .andWhere('doc_id', '<=', maxProjectId)
    .orderBy('doc_id')
    .limit(batchSize)
    .pluck('doc_id')
  return projectIds
}

async function getChunkIdsByProject(projectIds) {
  const chunks = await knex('chunks')
    .select('id', { projectId: 'doc_id' })
    .where('doc_id', 'in', projectIds)
  const chunkIdsByProject = new Map()
  for (const projectId of projectIds) {
    chunkIdsByProject.set(projectId, [])
  }
  for (const chunk of chunks) {
    chunkIdsByProject.get(chunk.projectId).push(chunk.id)
  }
  return chunkIdsByProject
}

async function processProject(projectId, chunkIds, globalBlobs) {
  try {
    const blobHashes = await getBlobHashes(projectId, chunkIds)
    const projectBlobHashes = blobHashes.filter(hash => !globalBlobs.has(hash))
    const gcsSizesByHash = new Map()
    for (const blobHash of projectBlobHashes) {
      const blobSize = await copyBlobInGcs(projectId, blobHash)
      if (blobSize != null) {
        gcsSizesByHash.set(blobHash, blobSize)
      }
    }
    const dbSizesByHash = await copyBlobsInDatabase(
      projectId,
      projectBlobHashes
    )
    compareBlobSizes(gcsSizesByHash, dbSizesByHash)
    return { projectId, success: true }
  } catch (err) {
    console.error(`Failed to process project ${projectId}:`, err.stack)
    return { projectId, success: false }
  }
}

function compareBlobSizes(gcsSizesByHash, dbSizesByHash) {
  // Throw an error if the database doesn't report as many blobs as GCS
  if (dbSizesByHash.size !== gcsSizesByHash.size) {
    throw new Error(
      `the database reported ${dbSizesByHash.size} blobs copied, but GCS reported ${gcsSizesByHash.size} blobs copied`
    )
  }

  const mismatches = []
  for (const [hash, dbSize] of dbSizesByHash.entries()) {
    if (gcsSizesByHash.get(hash) !== dbSize) {
      mismatches.push(hash)
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`blob size mismatch for hashes: ${mismatches.join(', ')}`)
  }
}

async function getHistory(projectId, chunkId) {
  const rawHistory = await historyStore.loadRaw(projectId, chunkId)
  const history = History.fromRaw(rawHistory)
  return history
}

async function getBlobHashes(projectId, chunkIds) {
  const blobHashes = new Set()
  for (const chunkId of chunkIds) {
    const history = await getHistory(projectId, chunkId)
    history.findBlobHashes(blobHashes)
  }
  return Array.from(blobHashes)
}

async function copyBlobInGcs(projectId, blobHash) {
  const globalBlobKey = [
    blobHash.slice(0, 2),
    blobHash.slice(2, 4),
    blobHash.slice(4),
  ].join('/')
  const projectBlobKey = [
    projectKey.format(projectId),
    blobHash.slice(0, 2),
    blobHash.slice(2),
  ].join('/')
  const globalBlobObject = globalBucket.file(globalBlobKey)
  const projectBlobObject = projectBucket.file(projectBlobKey)

  // Check if the project blob exists
  let projectBlobMetadata = null
  try {
    ;[projectBlobMetadata] = await projectBlobObject.getMetadata()
  } catch (err) {
    if (err.code !== 404) {
      throw err
    }
  }

  // Check that the blob exists
  let globalBlobMetadata = null
  try {
    ;[globalBlobMetadata] = await globalBlobObject.getMetadata()
  } catch (err) {
    if (err.code !== 404) {
      throw err
    }
  }

  if (projectBlobMetadata) {
    // Project blob already exists. Compare the metadata if the global blob
    // also exists and return early.
    if (
      globalBlobMetadata != null &&
      (globalBlobMetadata.size !== projectBlobMetadata.size ||
        globalBlobMetadata.md5Hash !== projectBlobMetadata.md5Hash)
    ) {
      throw new Error(
        `Project blob ${blobHash} in project ${projectId} doesn't match global blob`
      )
    }
    return null
  }

  await globalBlobObject.copy(projectBlobObject)

  // Paranoid check that the copy went well. The getMetadata() method returns
  // an array, with the metadata in first position.
  ;[projectBlobMetadata] = await projectBlobObject.getMetadata()
  if (
    globalBlobMetadata.size !== projectBlobMetadata.size ||
    globalBlobMetadata.md5Hash !== projectBlobMetadata.md5Hash
  ) {
    throw new Error(`Failed to copy blob ${blobHash} to project ${projectId})`)
  }

  return parseInt(projectBlobMetadata.size, 10)
}

async function copyBlobsInDatabase(projectId, blobHashes) {
  const blobSizesByHash = new Map()
  if (blobHashes.length === 0) {
    return blobSizesByHash
  }
  const binaryBlobHashes = blobHashes.map(hash => Buffer.from(hash, 'hex'))
  const result = await knex.raw(
    `INSERT INTO project_blobs (
      project_id, hash_bytes, byte_length, string_length
    )
    SELECT ?, hash_bytes, byte_length, string_length
    FROM blobs
    WHERE hash_bytes IN (${binaryBlobHashes.map(_ => '?').join(',')})
    ON CONFLICT (project_id, hash_bytes) DO NOTHING
    RETURNING hash_bytes, byte_length`,
    [projectId, ...binaryBlobHashes]
  )
  for (const row of result.rows) {
    blobSizesByHash.set(row.hash_bytes.toString('hex'), row.byte_length)
  }
  return blobSizesByHash
}

main()
  .then(() => {
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
