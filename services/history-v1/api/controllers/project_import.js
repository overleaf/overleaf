// @ts-check

'use strict'

const config = require('config')
const { expressify } = require('@overleaf/promise-utils')

const HTTPStatus = require('http-status')

const core = require('overleaf-editor-core')
const Change = core.Change
const Chunk = core.Chunk
const File = core.File
const FileMap = core.FileMap
const Origin = core.Origin
const Snapshot = core.Snapshot
const TextOperation = core.TextOperation

const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')

const storage = require('../../storage')
const BatchBlobStore = storage.BatchBlobStore
const BlobStore = storage.BlobStore
const chunkStore = storage.chunkStore
const HashCheckBlobStore = storage.HashCheckBlobStore
const commitChanges = storage.commitChanges
const persistBuffer = storage.persistBuffer
const buildSetContentChange = storage.buildSetContentChange
const InvalidChangeError = storage.InvalidChangeError

const render = require('./render')
const { parseReq } = require('@overleaf/validation-tools')
const schemas = require('../schema')
const Rollout = require('../app/rollout')
const redisBackend = require('../../storage/lib/chunk_store/redis')

const rollout = new Rollout(config)
rollout.report(logger) // display the rollout configuration in the logs

async function importSnapshot(req, res) {
  const { params, body } = parseReq(req, schemas.importSnapshot, {
    fallbackSchema: schemas.importSnapshotFallbackSchema,
  })
  const projectId = params.project_id
  let snapshot

  try {
    snapshot = Snapshot.fromRaw(body)
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

// Limits that force us to persist all of the changes.
function getPersistLimits() {
  const farFuture = new Date()
  farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
  return {
    maxChanges: 0,
    minChangeTimestamp: farFuture,
    maxChangeTimestamp: farFuture,
  }
}

async function importChanges(req, res, next) {
  const { params, query, body } = parseReq(req, schemas.importChanges, {
    fallbackSchema: schemas.importChangesFallbackSchema,
  })
  const projectId = params.project_id
  const endVersion = query.end_version
  const returnSnapshot = query.return_snapshot ?? 'none'

  let changes

  try {
    changes = body.map(rawChange => Change.mustFromRaw(rawChange))
  } catch (err) {
    logger.warn({ err, projectId }, 'failed to parse changes')
    return render.unprocessableEntity(res)
  }

  const limits = getPersistLimits()

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
    const { historyBufferLevel, forcePersistBuffer } =
      rollout.getHistoryBufferLevelOptions(projectId)
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

async function setContent(req, res) {
  const { params, body } = parseReq(req, schemas.setContent)
  const projectId = params.project_id
  const { pathname, source, userId, timestamp, metadata, trackChanges } = body
  const content = 'content' in body ? body.content : undefined
  const blobHash = 'blobHash' in body ? body.blobHash : undefined
  if (timestamp == null) {
    // The schema requires a timestamp; this narrows the type for the checker.
    return render.unprocessableEntity(res)
  }

  let result
  try {
    result = await buildSetContentChange(projectId, pathname, {
      content,
      blobHash,
      metadata,
      userId,
      timestamp,
      origin: new Origin(source),
      trackChanges,
    })
  } catch (err) {
    if (err instanceof storage.ContentTooLargeError) {
      return render.requestEntityTooLarge(res)
    } else if (err instanceof Chunk.NotFoundError) {
      logger.warn({ err, projectId }, 'chunk not found')
      return render.notFound(res)
    } else if (
      err instanceof storage.BlobNotFoundError ||
      err instanceof TextOperation.UnprocessableError ||
      err instanceof File.NotEditableError ||
      err instanceof FileMap.PathnameError ||
      err instanceof Snapshot.EditMissingFileError ||
      err instanceof InvalidChangeError ||
      (err instanceof OError &&
        err.message.startsWith('StringFileData.trackedChanges out of sync'))
    ) {
      logger.warn({ err, projectId, pathname }, 'set content rejected')
      return render.unprocessableEntity(res)
    } else {
      throw err
    }
  }

  const { change, baseVersion } = result
  res.status(HTTPStatus.OK).json({
    baseVersion,
    change: change ? change.toRaw() : null,
  })
}

async function flushChanges(req, res, next) {
  const { params } = parseReq(req, schemas.flushChanges, {
    fallbackSchema: schemas.flushChangesFallbackSchema,
  })
  const projectId = params.project_id
  // Use the same limits importChanges, since these are passed to persistChanges
  const limits = {
    ...getPersistLimits(),
    autoResync: true,
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

async function expireProject(req, res, next) {
  const { params } = parseReq(req, schemas.expireProject, {
    fallbackSchema: schemas.expireProjectFallbackSchema,
  })
  const projectId = params.project_id
  await redisBackend.expireProject(projectId)
  res.status(HTTPStatus.OK).end()
}

exports.importSnapshot = expressify(importSnapshot)
exports.importChanges = expressify(importChanges)
exports.setContent = expressify(setContent)
exports.flushChanges = expressify(flushChanges)
exports.expireProject = expressify(expireProject)
