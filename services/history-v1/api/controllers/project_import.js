// @ts-check

'use strict'

const { expressify } = require('@overleaf/promise-utils')

const HTTPStatus = require('http-status')

const core = require('overleaf-editor-core')
const Change = core.Change
const Chunk = core.Chunk
const File = core.File
const FileMap = core.FileMap
const Snapshot = core.Snapshot
const TextOperation = core.TextOperation

const logger = require('@overleaf/logger')

const storage = require('../../storage')
const BatchBlobStore = storage.BatchBlobStore
const BlobStore = storage.BlobStore
const chunkStore = storage.chunkStore
const HashCheckBlobStore = storage.HashCheckBlobStore
const commitChanges = storage.commitChanges
const persistBuffer = storage.persistBuffer
const InvalidChangeError = storage.InvalidChangeError

const render = require('./render')

const config = require('config')
// The history buffer level is used to determine whether to queue changes
// in Redis or persist them directly to the chunk store.
// If defaults to 0 (no queuing) if not set.
const historyBufferLevel = config.has('historyBufferLevel')
  ? parseInt(config.historyBufferLevel, 10)
  : 0
// The forcePersistBuffer flag will ensure the buffer is fully persisted before
// any persist operation. Set this to true if you want to make the persisted-version
// in Redis match the endVersion of the latest chunk. This should be set to true
// when downgrading from a history buffer level that queues changes in Redis
// without persisting them immediately.
const forcePersistBuffer = config.has('forcePersistBuffer')
  ? config.get('forcePersistBuffer') === 'true'
  : false

logger.info(
  { historyBufferLevel, forcePersistBuffer },
  historyBufferLevel > 0 || forcePersistBuffer
    ? 'using history buffer'
    : 'history buffer disabled'
)

async function importSnapshot(req, res) {
  const projectId = req.swagger.params.project_id.value
  const rawSnapshot = req.swagger.params.snapshot.value

  let snapshot

  try {
    snapshot = Snapshot.fromRaw(rawSnapshot)
  } catch (err) {
    logger.warn({ err, projectId }, 'failed to import snapshot')
    return render.unprocessableEntity(res)
  }

  let historyId
  try {
    historyId = await chunkStore.initializeProject(projectId, snapshot)
  } catch (err) {
    if (err instanceof chunkStore.AlreadyInitialized) {
      logger.warn({ err, projectId }, 'already initialized')
      return render.conflict(res)
    } else {
      throw err
    }
  }

  res.status(HTTPStatus.OK).json({ projectId: historyId })
}

async function importChanges(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const rawChanges = req.swagger.params.changes.value
  const endVersion = req.swagger.params.end_version.value
  const returnSnapshot = req.swagger.params.return_snapshot.value || 'none'

  let changes

  try {
    changes = rawChanges.map(Change.fromRaw)
  } catch (err) {
    logger.warn({ err, projectId }, 'failed to parse changes')
    return render.unprocessableEntity(res)
  }

  // Set limits to force us to persist all of the changes.
  const farFuture = new Date()
  farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
  const limits = {
    maxChanges: 0,
    minChangeTimestamp: farFuture,
    maxChangeTimestamp: farFuture,
  }

  const blobStore = new BlobStore(projectId)
  const batchBlobStore = new BatchBlobStore(blobStore)
  const hashCheckBlobStore = new HashCheckBlobStore(blobStore)

  async function loadFiles() {
    const blobHashes = new Set()
    for (const change of changes) {
      // This populates the set blobHashes with blobs referred to in the change
      change.findBlobHashes(blobHashes)
    }

    await batchBlobStore.preload(Array.from(blobHashes))

    for (const change of changes) {
      await change.loadFiles('lazy', batchBlobStore)
    }
  }

  async function buildResultSnapshot(resultChunk) {
    const chunk =
      resultChunk ||
      (await chunkStore.loadLatest(projectId, { persistedOnly: true }))
    const snapshot = chunk.getSnapshot()
    snapshot.applyAll(chunk.getChanges())
    const rawSnapshot = await snapshot.store(hashCheckBlobStore)
    return rawSnapshot
  }

  await loadFiles()

  let result
  try {
    result = await commitChanges(projectId, changes, limits, endVersion, {
      historyBufferLevel,
      forcePersistBuffer,
    })
  } catch (err) {
    if (
      err instanceof Chunk.ConflictingEndVersion ||
      err instanceof TextOperation.UnprocessableError ||
      err instanceof File.NotEditableError ||
      err instanceof FileMap.PathnameError ||
      err instanceof Snapshot.EditMissingFileError ||
      err instanceof chunkStore.ChunkVersionConflictError ||
      err instanceof InvalidChangeError
    ) {
      // If we failed to apply operations, that's probably because they were
      // invalid.
      logger.warn({ err, projectId, endVersion }, 'changes rejected by history')
      return render.unprocessableEntity(res)
    } else if (err instanceof Chunk.NotFoundError) {
      logger.warn({ err, projectId }, 'chunk not found')
      return render.notFound(res)
    } else {
      throw err
    }
  }

  if (returnSnapshot === 'none') {
    res.status(HTTPStatus.CREATED).json({
      resyncNeeded: result.resyncNeeded,
    })
  } else {
    const rawSnapshot = await buildResultSnapshot(result && result.currentChunk)
    res.status(HTTPStatus.CREATED).json(rawSnapshot)
  }
}

async function flushChanges(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  // Use the same limits importChanges, since these are passed to persistChanges
  const farFuture = new Date()
  farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
  const limits = {
    maxChanges: 0,
    minChangeTimestamp: farFuture,
    maxChangeTimestamp: farFuture,
  }
  try {
    await persistBuffer(projectId, limits)
    res.status(HTTPStatus.OK).end()
  } catch (err) {
    if (err instanceof Chunk.NotFoundError) {
      render.notFound(res)
    } else {
      throw err
    }
  }
}

exports.importSnapshot = expressify(importSnapshot)
exports.importChanges = expressify(importChanges)
exports.flushChanges = expressify(flushChanges)
