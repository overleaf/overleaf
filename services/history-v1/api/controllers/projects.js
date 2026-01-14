'use strict'

const _ = require('lodash')
const Path = require('node:path')
const Stream = require('node:stream')
const HTTPStatus = require('http-status')
const fs = require('node:fs')
const { promisify } = require('node:util')
const config = require('config')
const OError = require('@overleaf/o-error')
const { expressify } = require('@overleaf/promise-utils')
const { parseReq } = require('@overleaf/validation-tools')

const logger = require('@overleaf/logger')
const { Chunk, ChunkResponse, Blob } = require('overleaf-editor-core')
const {
  BlobStore,
  BatchBlobStore,
  blobHash,
  chunkStore,
  redisBuffer,
  HashCheckBlobStore,
  ProjectArchive,
  zipStore,
} = require('../../storage')

const render = require('./render')
const schemas = require('../schema')
const withTmpDir = require('./with_tmp_dir')
const StreamSizeLimit = require('./stream_size_limit')
const { getProjectBlobsBatch } = require('../../storage/lib/blob_store')
const assert = require('../../storage/lib/assert')
const { getChunkMetadataForVersion } = require('../../storage/lib/chunk_store')

const pipeline = promisify(Stream.pipeline)

async function initializeProject(req, res, next) {
  const { body } = parseReq(req, schemas.initializeProject)
  let projectId = body?.projectId
  try {
    projectId = await chunkStore.initializeProject(projectId)
    res.status(HTTPStatus.OK).json({ projectId })
  } catch (err) {
    if (err instanceof chunkStore.AlreadyInitialized) {
      logger.warn({ err, projectId }, 'failed to initialize')
      render.conflict(res)
    } else {
      throw err
    }
  }
}

async function getLatestContent(req, res, next) {
  const { params } = parseReq(req, schemas.getLatestContent)
  const projectId = params.project_id
  const blobStore = new BlobStore(projectId)
  const chunk = await chunkStore.loadLatest(projectId)
  const snapshot = chunk.getSnapshot()
  snapshot.applyAll(chunk.getChanges())
  await snapshot.loadFiles('eager', blobStore)
  res.json(snapshot.toRaw())
}

async function getContentAtVersion(req, res, next) {
  const { params } = parseReq(req, schemas.getContentAtVersion)
  const projectId = params.project_id
  const version = params.version
  const blobStore = new BlobStore(projectId)
  const snapshot = await getSnapshotAtVersion(projectId, version)
  await snapshot.loadFiles('eager', blobStore)
  res.json(snapshot.toRaw())
}

async function getLatestHashedContent(req, res, next) {
  const { params } = parseReq(req, schemas.getLatestHashedContent)
  const projectId = params.project_id
  const blobStore = new HashCheckBlobStore(new BlobStore(projectId))
  const chunk = await chunkStore.loadLatest(projectId)
  const snapshot = chunk.getSnapshot()
  snapshot.applyAll(chunk.getChanges())
  await snapshot.loadFiles('eager', blobStore)
  const rawSnapshot = await snapshot.store(blobStore)
  res.json(rawSnapshot)
}

async function getLatestHistory(req, res, next) {
  const { params } = parseReq(req, schemas.getLatestHistory)
  const projectId = params.project_id
  try {
    const chunk = await chunkStore.loadLatest(projectId)
    const chunkResponse = new ChunkResponse(chunk)
    res.json(chunkResponse.toRaw())
  } catch (err) {
    if (err instanceof Chunk.NotFoundError) {
      render.notFound(res)
    } else {
      throw err
    }
  }
}

async function getLatestHistoryRaw(req, res, next) {
  const { params, query } = parseReq(req, schemas.getLatestHistoryRaw)
  const projectId = params.project_id
  const readOnly = query.readOnly
  try {
    const { startVersion, endVersion, endTimestamp } =
      await chunkStore.getLatestChunkMetadata(projectId, { readOnly })
    res.json({
      startVersion,
      endVersion,
      endTimestamp,
    })
  } catch (err) {
    if (err instanceof Chunk.NotFoundError) {
      render.notFound(res)
    } else {
      throw err
    }
  }
}

async function getHistory(req, res, next) {
  const { params } = parseReq(req, schemas.getHistory)
  const projectId = params.project_id
  const version = params.version
  try {
    const chunk = await chunkStore.loadAtVersion(projectId, version)
    const chunkResponse = new ChunkResponse(chunk)
    res.json(chunkResponse.toRaw())
  } catch (err) {
    if (err instanceof Chunk.NotFoundError) {
      render.notFound(res)
    } else {
      throw err
    }
  }
}

async function getHistoryBefore(req, res, next) {
  const { params } = parseReq(req, schemas.getHistoryBefore)
  const projectId = params.project_id
  const timestamp = params.timestamp
  try {
    const chunk = await chunkStore.loadAtTimestamp(projectId, timestamp)
    const chunkResponse = new ChunkResponse(chunk)
    res.json(chunkResponse.toRaw())
  } catch (err) {
    if (err instanceof Chunk.NotFoundError) {
      render.notFound(res)
    } else {
      throw err
    }
  }
}

/**
 * Get all changes since the beginning of history or since a given version
 */
async function getChanges(req, res, next) {
  const { params, query } = parseReq(req, schemas.getChanges)
  const projectId = params.project_id
  const sinceParam = query.since
  const since = sinceParam == null ? 0 : sinceParam

  if (since < 0) {
    // Negative values would cause an infinite loop
    return res.status(400).json({
      error: `Version out of bounds: ${since}`,
    })
  }

  try {
    const { changes, hasMore } = await chunkStore.getChangesSinceVersion(
      projectId,
      since
    )
    res.json({ changes: changes.map(change => change.toRaw()), hasMore })
  } catch (err) {
    if (err instanceof Chunk.VersionNotFoundError) {
      return res.status(400).json({
        error: `Version out of bounds: ${since}`,
      })
    }
    throw err
  }
}

async function getZip(req, res, next) {
  const { params } = parseReq(req, schemas.getZip)
  const projectId = params.project_id
  const version = params.version
  const blobStore = new BlobStore(projectId)

  let snapshot
  try {
    snapshot = await getSnapshotAtVersion(projectId, version)
  } catch (err) {
    if (err instanceof Chunk.NotFoundError) {
      return render.notFound(res)
    } else {
      throw err
    }
  }

  await withTmpDir('get-zip-', async tmpDir => {
    const tmpFilename = Path.join(tmpDir, 'project.zip')
    const archive = new ProjectArchive(snapshot)
    await archive.writeZip(blobStore, tmpFilename)
    res.set('Content-Type', 'application/octet-stream')
    res.set('Content-Disposition', 'attachment; filename=project.zip')
    const stream = fs.createReadStream(tmpFilename)
    await pipeline(stream, res)
  })
}

async function createZip(req, res, next) {
  const { params } = parseReq(req, schemas.createZip)
  const projectId = params.project_id
  const version = params.version
  try {
    const snapshot = await getSnapshotAtVersion(projectId, version)
    const zipUrl = await zipStore.getSignedUrl(projectId, version)
    // Do not await this; run it in the background.
    zipStore.storeZip(projectId, version, snapshot).catch(err => {
      logger.error({ err, projectId, version }, 'createZip: storeZip failed')
    })
    res.status(HTTPStatus.OK).json({ zipUrl })
  } catch (error) {
    if (error instanceof Chunk.NotFoundError) {
      render.notFound(res)
    } else {
      next(error)
    }
  }
}

async function deleteProject(req, res, next) {
  const { params } = parseReq(req, schemas.deleteProject)
  const projectId = params.project_id
  const blobStore = new BlobStore(projectId)

  await Promise.all([
    redisBuffer.hardDeleteProject(projectId),
    chunkStore.deleteProjectChunks(projectId),
    blobStore.deleteBlobs(),
  ])
  res.status(HTTPStatus.NO_CONTENT).send()
}

async function createProjectBlob(req, res, next) {
  const { params } = parseReq(req, schemas.createProjectBlob)
  const projectId = params.project_id
  const expectedHash = params.hash
  const maxUploadSize = parseInt(config.get('maxFileUploadSize'), 10)

  await withTmpDir('blob-', async tmpDir => {
    const tmpPath = Path.join(tmpDir, 'content')
    const sizeLimit = new StreamSizeLimit(maxUploadSize)
    await pipeline(req, sizeLimit, fs.createWriteStream(tmpPath))
    if (sizeLimit.sizeLimitExceeded) {
      logger.warn(
        { projectId, expectedHash, maxUploadSize },
        'blob exceeds size threshold'
      )
      return render.requestEntityTooLarge(res)
    }
    const hash = await blobHash.fromFile(tmpPath)
    if (hash !== expectedHash) {
      logger.warn({ projectId, hash, expectedHash }, 'Hash mismatch')
      return render.conflict(res, 'File hash mismatch')
    }

    const blobStore = new BlobStore(projectId)
    const newBlob = await blobStore.putFile(tmpPath)

    if (config.has('backupStore')) {
      try {
        const { backupBlob } = await import('../../storage/lib/backupBlob.mjs')
        await backupBlob(projectId, newBlob, tmpPath)
      } catch (error) {
        logger.warn({ error, projectId, hash }, 'Failed to backup blob')
      }
    }
    res.status(HTTPStatus.CREATED).end()
  })
}

async function headProjectBlob(req, res) {
  const { params } = parseReq(req, schemas.headProjectBlob)
  const projectId = params.project_id
  const hash = params.hash

  const blobStore = new BlobStore(projectId)
  const blob = await blobStore.getBlob(hash)
  if (blob) {
    res.set('Content-Length', blob.getByteLength())
    res.status(200).end()
  } else {
    res.status(404).end()
  }
}
// Support simple, singular ranges starting from zero only, up-to 2MB = 2_000_000, 7 digits
const RANGE_HEADER = /^bytes=(\d{1,7})-(\d{1,7})$/

/**
 * @param {string} header
 * @return {undefined | {start: number, end: number}}
 * @private
 */
function _getRangeOpts(header) {
  if (!header) return undefined
  const match = header.match(RANGE_HEADER)
  if (match) {
    const start = parseInt(match[1], 10)
    const end = parseInt(match[2], 10)
    return { start, end }
  }
  return undefined
}

async function getProjectBlob(req, res, next) {
  const { params, headers } = parseReq(req, schemas.getProjectBlob)
  const projectId = params.project_id
  const hash = params.hash
  const rangeHeader = headers.range || ''
  const opts = _getRangeOpts(rangeHeader)

  const blobStore = new BlobStore(projectId)
  logger.debug({ projectId, hash }, 'getProjectBlob started')
  try {
    if (req.method === 'HEAD') {
      return await headProjectBlob(req, res)
    }

    let stream
    try {
      if (opts) {
        // This is a range request, so we need to set the appropriate headers
        // Browser caching only works if the total size is known, so we have
        // to fetch the blob metadata first.
        const metaData = await blobStore.getBlob(hash)
        if (metaData) {
          const blobLength = metaData.getByteLength()
          if (opts.start > opts.end || opts.start >= blobLength) {
            return res
              .status(416) // Requested Range Not Satisfiable
              .set('Content-Range', `bytes */${blobLength}`)
              .set('Content-Length', '0')
              .end()
          }
          // Valid range request
          const actualEnd = Math.min(opts.end, blobLength - 1)
          const returnedSize = actualEnd - opts.start + 1
          res.set('Content-Length', returnedSize)
          res.set(
            'Content-Range',
            `bytes ${opts.start}-${actualEnd}/${blobLength}`
          )
          res.status(206)
        }
      }
      stream = await blobStore.getStream(hash, opts)
    } catch (err) {
      if (err instanceof Blob.NotFoundError) {
        logger.warn({ projectId, hash }, 'Blob not found')
        return res.status(404).end()
      } else {
        throw err
      }
    }
    res.set('Content-Type', 'application/octet-stream')
    try {
      await pipeline(stream, res)
    } catch (err) {
      if (err?.code === 'ERR_STREAM_PREMATURE_CLOSE') {
        res.end()
      } else {
        throw OError.tag(err, 'error transferring stream', { projectId, hash })
      }
    }
  } finally {
    logger.debug({ projectId, hash }, 'getProjectBlob finished')
  }
}

async function copyProjectBlob(req, res, next) {
  const { params, query } = parseReq(req, schemas.copyProjectBlob)
  const sourceProjectId = query.copyFrom
  const targetProjectId = params.project_id
  const blobHash = params.hash
  // Check that blob exists in source project
  const sourceBlobStore = new BlobStore(sourceProjectId)
  const targetBlobStore = new BlobStore(targetProjectId)
  const [sourceBlob, targetBlob] = await Promise.all([
    sourceBlobStore.getBlob(blobHash),
    targetBlobStore.getBlob(blobHash),
  ])
  if (!sourceBlob) {
    logger.warn(
      { sourceProjectId, targetProjectId, blobHash },
      'missing source blob when copying across projects'
    )
    return render.notFound(res)
  }
  // Exit early if the blob exists in the target project.
  // This will also catch global blobs, which always exist.
  if (targetBlob) {
    return res.status(HTTPStatus.NO_CONTENT).end()
  }
  // Otherwise, copy blob from source project to target project
  await sourceBlobStore.copyBlob(sourceBlob, targetProjectId)
  res.status(HTTPStatus.CREATED).end()
}

async function getSnapshotAtVersion(projectId, version) {
  const chunk = await chunkStore.loadAtVersion(projectId, version)
  const snapshot = chunk.getSnapshot()
  const changes = _.dropRight(
    chunk.getChanges(),
    chunk.getEndVersion() - version
  )

  if (changes.length > 0) {
    snapshot.applyAll(changes)
  } else {
    // There are no changes in this chunk; we need to look at the previous chunk
    // to get the snapshot's timestamp
    let chunkMetadata
    try {
      chunkMetadata = await getChunkMetadataForVersion(projectId, version)
    } catch (err) {
      if (err instanceof Chunk.VersionNotFoundError) {
        // The snapshot is the first snapshot of the first chunk, so we can't
        // find a timestamp. This shouldn't happen often. Ignore the error and
        // leave the timestamp empty.
      } else {
        throw err
      }
    }

    snapshot.setTimestamp(chunkMetadata.endTimestamp)
  }

  return snapshot
}

function sumUpByteLength(blobs) {
  return blobs.reduce((sum, blob) => sum + blob.getByteLength(), 0)
}

async function getBlobStats(req, res) {
  const { params, body } = parseReq(req, schemas.getBlobStats)
  const projectId = params.project_id
  const blobHashes = body.blobHashes || []
  for (const hash of blobHashes) {
    assert.blobHash(hash, 'bad hash')
  }
  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)
  await batchBlobStore.preload(Array.from(blobHashes))
  const blobs = Array.from(batchBlobStore.blobs.values()).filter(Boolean)
  const textBlobs = blobs.filter(b => b.getStringLength() !== null)
  const binaryBlobs = blobs.filter(b => b.getStringLength() === null)
  const textBlobBytes = sumUpByteLength(textBlobs)
  const binaryBlobBytes = sumUpByteLength(binaryBlobs)
  res.json({
    projectId,
    textBlobBytes,
    binaryBlobBytes,
    totalBytes: textBlobBytes + binaryBlobBytes,
    nTextBlobs: textBlobs.length,
    nBinaryBlobs: binaryBlobs.length,
  })
}

async function getProjectBlobsStats(req, res) {
  const { body } = parseReq(req, schemas.getProjectBlobsStats)
  const projectIds = body.projectIds
  const { blobs } = await getProjectBlobsBatch(
    projectIds.map(id => {
      if (assert.POSTGRES_ID_REGEXP.test(id)) {
        return parseInt(id, 10)
      } else {
        return id
      }
    })
  )
  const sizes = []
  for (const projectId of projectIds) {
    const projectBlobs = blobs.get(projectId) || []
    const textBlobs = projectBlobs.filter(b => b.getStringLength() !== null)
    const binaryBlobs = projectBlobs.filter(b => b.getStringLength() === null)
    const textBlobBytes = sumUpByteLength(textBlobs)
    const binaryBlobBytes = sumUpByteLength(binaryBlobs)
    sizes.push({
      projectId,
      textBlobBytes,
      binaryBlobBytes,
      totalBytes: textBlobBytes + binaryBlobBytes,
      nTextBlobs: textBlobs.length,
      nBinaryBlobs: binaryBlobs.length,
    })
  }
  res.json(sizes)
}

module.exports = {
  initializeProject: expressify(initializeProject),
  getLatestContent: expressify(getLatestContent),
  getContentAtVersion: expressify(getContentAtVersion),
  getLatestHashedContent: expressify(getLatestHashedContent),
  getLatestPersistedHistory: expressify(getLatestHistory),
  getLatestHistory: expressify(getLatestHistory),
  getLatestHistoryRaw: expressify(getLatestHistoryRaw),
  getHistory: expressify(getHistory),
  getHistoryBefore: expressify(getHistoryBefore),
  getChanges: expressify(getChanges),
  getZip: expressify(getZip),
  createZip: expressify(createZip),
  deleteProject: expressify(deleteProject),
  createProjectBlob: expressify(createProjectBlob),
  getProjectBlob: expressify(getProjectBlob),
  headProjectBlob: expressify(headProjectBlob),
  copyProjectBlob: expressify(copyProjectBlob),
  getBlobStats: expressify(getBlobStats),
  getProjectBlobsStats: expressify(getProjectBlobsStats),
}
