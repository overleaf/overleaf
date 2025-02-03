'use strict'

const _ = require('lodash')
const Path = require('node:path')
const Stream = require('node:stream')
const HTTPStatus = require('http-status')
const fs = require('node:fs')
const { promisify } = require('node:util')
const config = require('config')
const OError = require('@overleaf/o-error')

const logger = require('@overleaf/logger')
const { Chunk, ChunkResponse, Blob } = require('overleaf-editor-core')
const {
  BlobStore,
  blobHash,
  chunkStore,
  HashCheckBlobStore,
  ProjectArchive,
  zipStore,
} = require('../../storage')

const render = require('./render')
const expressify = require('./expressify')
const withTmpDir = require('./with_tmp_dir')
const StreamSizeLimit = require('./stream_size_limit')

const pipeline = promisify(Stream.pipeline)

async function initializeProject(req, res, next) {
  let projectId = req.swagger.params.body.value.projectId
  try {
    projectId = await chunkStore.initializeProject(projectId)
    res.status(HTTPStatus.OK).json({ projectId })
  } catch (err) {
    if (err instanceof chunkStore.AlreadyInitialized) {
      render.conflict(res)
    } else {
      throw err
    }
  }
}

async function getLatestContent(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const blobStore = new BlobStore(projectId)
  const chunk = await chunkStore.loadLatest(projectId)
  const snapshot = chunk.getSnapshot()
  snapshot.applyAll(chunk.getChanges())
  await snapshot.loadFiles('eager', blobStore)
  res.json(snapshot.toRaw())
}

async function getContentAtVersion(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const version = req.swagger.params.version.value
  const blobStore = new BlobStore(projectId)
  const snapshot = await getSnapshotAtVersion(projectId, version)
  await snapshot.loadFiles('eager', blobStore)
  res.json(snapshot.toRaw())
}

async function getLatestHashedContent(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const blobStore = new HashCheckBlobStore(new BlobStore(projectId))
  const chunk = await chunkStore.loadLatest(projectId)
  const snapshot = chunk.getSnapshot()
  snapshot.applyAll(chunk.getChanges())
  await snapshot.loadFiles('eager', blobStore)
  const rawSnapshot = await snapshot.store(blobStore)
  res.json(rawSnapshot)
}

async function getLatestHistory(req, res, next) {
  const projectId = req.swagger.params.project_id.value
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
  const projectId = req.swagger.params.project_id.value
  const readOnly = req.swagger.params.readOnly.value
  try {
    const { startVersion, endVersion, endTimestamp } =
      await chunkStore.loadLatestRaw(projectId, { readOnly })
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
  const projectId = req.swagger.params.project_id.value
  const version = req.swagger.params.version.value
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
  const projectId = req.swagger.params.project_id.value
  const timestamp = req.swagger.params.timestamp.value
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

async function getZip(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const version = req.swagger.params.version.value
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
  const projectId = req.swagger.params.project_id.value
  const version = req.swagger.params.version.value
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
  const projectId = req.swagger.params.project_id.value
  const blobStore = new BlobStore(projectId)
  await Promise.all([
    chunkStore.deleteProjectChunks(projectId),
    blobStore.deleteBlobs(),
  ])
  res.status(HTTPStatus.NO_CONTENT).send()
}

async function createProjectBlob(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const expectedHash = req.swagger.params.hash.value
  const maxUploadSize = parseInt(config.get('maxFileUploadSize'), 10)

  await withTmpDir('blob-', async tmpDir => {
    const tmpPath = Path.join(tmpDir, 'content')
    const sizeLimit = new StreamSizeLimit(maxUploadSize)
    await pipeline(req, sizeLimit, fs.createWriteStream(tmpPath))
    if (sizeLimit.sizeLimitExceeded) {
      return render.requestEntityTooLarge(res)
    }
    const hash = await blobHash.fromFile(tmpPath)
    if (hash !== expectedHash) {
      logger.debug({ hash, expectedHash }, 'Hash mismatch')
      return render.conflict(res, 'File hash mismatch')
    }

    const blobStore = new BlobStore(projectId)
    const newBlob = await blobStore.putFile(tmpPath)

    try {
      const { backupBlob } = await import('../../storage/lib/backupBlob.mjs')
      await backupBlob(projectId, newBlob, tmpPath)
    } catch (error) {
      logger.warn({ error, projectId, hash }, 'Failed to backup blob')
    }
    res.status(HTTPStatus.CREATED).end()
  })
}

async function headProjectBlob(req, res) {
  const projectId = req.swagger.params.project_id.value
  const hash = req.swagger.params.hash.value

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
const RANGE_HEADER = /^bytes=0-(\d{1,7})$/

/**
 * @param {string} header
 * @return {{}|{start: number, end: number}}
 * @private
 */
function _getRangeOpts(header) {
  if (!header) return {}
  const match = header.match(RANGE_HEADER)
  if (match) {
    const end = parseInt(match[1], 10)
    return { start: 0, end }
  }
  return {}
}

async function getProjectBlob(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const hash = req.swagger.params.hash.value
  const opts = _getRangeOpts(req.swagger.params.range.value || '')

  const blobStore = new BlobStore(projectId)
  logger.debug({ projectId, hash }, 'getProjectBlob started')
  try {
    let stream
    try {
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
  const sourceProjectId = req.swagger.params.copyFrom.value
  const targetProjectId = req.swagger.params.project_id.value
  const blobHash = req.swagger.params.hash.value
  // Check that blob exists in source project
  const sourceBlobStore = new BlobStore(sourceProjectId)
  const targetBlobStore = new BlobStore(targetProjectId)
  const [sourceBlob, targetBlob] = await Promise.all([
    sourceBlobStore.getBlob(blobHash),
    targetBlobStore.getBlob(blobHash),
  ])
  if (!sourceBlob) {
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
  snapshot.applyAll(changes)
  return snapshot
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
  getZip: expressify(getZip),
  createZip: expressify(createZip),
  deleteProject: expressify(deleteProject),
  createProjectBlob: expressify(createProjectBlob),
  getProjectBlob: expressify(getProjectBlob),
  headProjectBlob: expressify(headProjectBlob),
  copyProjectBlob: expressify(copyProjectBlob),
}
