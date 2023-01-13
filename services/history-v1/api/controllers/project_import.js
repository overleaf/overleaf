'use strict'

const BPromise = require('bluebird')
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
const persistChanges = storage.persistChanges

const render = require('./render')

exports.importSnapshot = function importSnapshot(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const rawSnapshot = req.swagger.params.snapshot.value

  let snapshot

  try {
    snapshot = Snapshot.fromRaw(rawSnapshot)
  } catch (err) {
    return render.unprocessableEntity(res)
  }

  return chunkStore
    .initializeProject(projectId, snapshot)
    .then(function (projectId) {
      res.status(HTTPStatus.OK).json({ projectId })
    })
    .catch(err => {
      if (err instanceof chunkStore.AlreadyInitialized) {
        render.conflict(res)
      } else {
        next(err)
      }
    })
}

exports.importChanges = function importChanges(req, res, next) {
  const projectId = req.swagger.params.project_id.value
  const rawChanges = req.swagger.params.changes.value
  const endVersion = req.swagger.params.end_version.value
  const returnSnapshot = req.swagger.params.return_snapshot.value || 'none'

  let changes

  try {
    changes = rawChanges.map(Change.fromRaw)
  } catch (err) {
    logger.error(err)
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

  function loadFiles() {
    const blobHashes = new Set()
    changes.forEach(function findBlobHashesToPreload(change) {
      change.findBlobHashes(blobHashes)
    })

    function lazyLoadChangeFiles(change) {
      return change.loadFiles('lazy', batchBlobStore)
    }

    return batchBlobStore
      .preload(Array.from(blobHashes))
      .then(function lazyLoadChangeFilesWithBatching() {
        return BPromise.each(changes, lazyLoadChangeFiles)
      })
  }

  function buildResultSnapshot(resultChunk) {
    return BPromise.resolve(
      resultChunk || chunkStore.loadLatest(projectId)
    ).then(function (chunk) {
      const snapshot = chunk.getSnapshot()
      snapshot.applyAll(chunk.getChanges())
      return snapshot.store(hashCheckBlobStore)
    })
  }

  return loadFiles()
    .then(function () {
      return persistChanges(projectId, changes, limits, endVersion)
    })
    .then(function (result) {
      if (returnSnapshot === 'none') {
        res.status(HTTPStatus.CREATED).json({})
      } else {
        return buildResultSnapshot(result && result.currentChunk).then(
          function (rawSnapshot) {
            res.status(HTTPStatus.CREATED).json(rawSnapshot)
          }
        )
      }
    })
    .catch(err => {
      if (
        err instanceof Chunk.ConflictingEndVersion ||
        err instanceof TextOperation.UnprocessableError ||
        err instanceof File.NotEditableError ||
        err instanceof FileMap.PathnameError ||
        err instanceof Snapshot.EditMissingFileError ||
        err instanceof chunkStore.ChunkVersionConflictError
      ) {
        // If we failed to apply operations, that's probably because they were
        // invalid.
        logger.error(err)
        render.unprocessableEntity(res)
      } else if (err instanceof Chunk.NotFoundError) {
        render.notFound(res)
      } else {
        next(err)
      }
    })
}
