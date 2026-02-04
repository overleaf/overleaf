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
const { parseReq } = require('@overleaf/validation-tools')
const schemas = require('../schema')
const Rollout = require('../app/rollout')
const redisBackend = require('../../storage/lib/chunk_store/redis')

const rollout = new Rollout(config)
rollout.report(logger) // display the rollout configuration in the logs

function getParam(req, name, location = 'path') {
  switch (location) {
    case 'path':
      return req.params?.[name]
    case 'query':
      return req.query?.[name]
    case 'body':
      if (name === 'body') {
        return req.body
      }
      if (req.body?.[name] !== undefined) {
        return req.body[name]
      }
      return undefined
    default:
      return undefined
  }
}
async function importSnapshot(req, res) {
  const { params, body } = parseReq(req, schemas.importSnapshot)
  const projectId = params.project_id
  const rawSnapshot = getParam({ body }, 'snapshot', 'body') ?? body
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
  const { params, query, body } = parseReq(req, schemas.importChanges)
  const projectId = params.project_id
  const rawChanges = getParam({ body }, 'changes', 'body') ?? body
  const endVersion = query.end_version
  const returnSnapshot = query.return_snapshot ?? 'none'

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

async function flushChanges(req, res, next) {
  const { params } = parseReq(req, schemas.flushChanges)
  const projectId = params.project_id
  // Use the same limits importChanges, since these are passed to persistChanges
  const farFuture = new Date()
  farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
  const limits = {
    maxChanges: 0,
    minChangeTimestamp: farFuture,
    maxChangeTimestamp: farFuture,
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
  const { params } = parseReq(req, schemas.expireProject)
  const projectId = params.project_id
  await redisBackend.expireProject(projectId)
  res.status(HTTPStatus.OK).end()
}

exports.importSnapshot = expressify(importSnapshot)
exports.importChanges = expressify(importChanges)
exports.flushChanges = expressify(flushChanges)
exports.expireProject = expressify(expireProject)
