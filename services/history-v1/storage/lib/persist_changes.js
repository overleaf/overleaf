// @ts-check

'use strict'

const _ = require('lodash')
const logger = require('@overleaf/logger')

const core = require('overleaf-editor-core')
const Chunk = core.Chunk
const History = core.History

const assert = require('./assert')
const chunkStore = require('./chunk_store')
const { BlobStore } = require('./blob_store')
const { InvalidChangeError } = require('./errors')
const { getContentHash } = require('./content_hash')

function countChangeBytes(change) {
  // Note: This is not quite accurate, because the raw change may contain raw
  // file info (or conceivably even content) that will not be included in the
  // actual stored object.
  return Buffer.byteLength(JSON.stringify(change.toRaw()))
}

function totalChangeBytes(changes) {
  return changes.length ? _(changes).map(countChangeBytes).sum() : 0
}

// provide a simple timer function
function Timer() {
  this.t0 = process.hrtime()
}
Timer.prototype.elapsed = function () {
  const dt = process.hrtime(this.t0)
  const timeInMilliseconds = (dt[0] + dt[1] * 1e-9) * 1e3
  return timeInMilliseconds
}

/**
 * Break the given set of changes into zero or more Chunks according to the
 * provided limits and store them.
 *
 * Some other possible improvements:
 * 1. This does a lot more JSON serialization than it has to. We may know the
 *    JSON for the changes before we call this function, so we could in that
 *    case get the byte size of each change without doing any work. Even if we
 *    don't know it initially, we could save some computation by caching this
 *    info rather than recomputing it many times. TBD whether it is worthwhile.
 * 2. We don't necessarily have to fetch the latest chunk in order to determine
 *    that it is full. We could store this in the chunk metadata record. It may
 *    be worth distinguishing between a Chunk and its metadata record. The
 *    endVersion may be better suited to the metadata record.
 *
 * @param {string} projectId
 * @param {core.Change[]} allChanges
 * @param {Object} limits
 * @param {number} clientEndVersion
 * @return {Promise.<Object?>}
 */
async function persistChanges(projectId, allChanges, limits, clientEndVersion) {
  assert.projectId(projectId)
  assert.array(allChanges)
  assert.maybe.object(limits)
  assert.integer(clientEndVersion)

  const blobStore = new BlobStore(projectId)

  let currentChunk

  /**
   * currentSnapshot tracks the latest change that we're applying; we use it to
   * check that the changes we are persisting are valid.
   *
   * @type {core.Snapshot}
   */
  let currentSnapshot

  let originalEndVersion
  let changesToPersist

  /**
   * It's only useful to log validation errors once per flush. When we enforce
   * content hash validation, it will stop the flush right away anyway.
   */
  let validationErrorLogged = false

  limits = limits || {}
  _.defaults(limits, {
    changeBucketMinutes: 60,
    maxChanges: 2500,
    maxChangeBytes: 5 * 1024 * 1024,
    maxChunkChanges: 2000,
    maxChunkChangeBytes: 5 * 1024 * 1024,
    maxChunkChangeTime: 5000, // warn if total time for changes in a chunk takes longer than this
  })

  function checkElapsedTime(timer) {
    const timeTaken = timer.elapsed()
    if (timeTaken > limits.maxChunkChangeTime) {
      console.log('warning: slow chunk', projectId, timeTaken)
    }
  }

  /**
   * Add changes to a chunk until the chunk is full
   *
   * The chunk is full if it reaches a certain number of changes or a certain
   * size in bytes
   *
   * @param {core.Chunk} chunk
   * @param {core.Change[]} changes
   */
  async function fillChunk(chunk, changes) {
    let totalBytes = totalChangeBytes(chunk.getChanges())
    let changesPushed = false
    while (changes.length > 0) {
      if (chunk.getChanges().length >= limits.maxChunkChanges) {
        break
      }

      const change = changes[0]
      const changeBytes = countChangeBytes(change)

      if (totalBytes + changeBytes > limits.maxChunkChangeBytes) {
        break
      }

      for (const operation of change.iterativelyApplyTo(currentSnapshot, {
        strict: true,
      })) {
        try {
          await validateContentHash(operation)
        } catch (err) {
          // Temporary: skip validation errors
          if (err instanceof InvalidChangeError) {
            if (!validationErrorLogged) {
              logger.warn(
                { err, projectId },
                'content snapshot mismatch (ignored)'
              )
              validationErrorLogged = true
            }
          } else {
            throw err
          }
        }
      }

      chunk.pushChanges([change])
      changes.shift()
      totalBytes += changeBytes
      changesPushed = true
    }
    return changesPushed
  }

  /**
   * Check that the operation is valid and can be incorporated to the history.
   *
   * For now, this checks content hashes when they are provided.
   *
   * @param {core.Operation} operation
   */
  async function validateContentHash(operation) {
    if (operation instanceof core.EditFileOperation) {
      const editOperation = operation.getOperation()
      if (
        editOperation instanceof core.TextOperation &&
        editOperation.contentHash != null
      ) {
        const path = operation.getPathname()
        const file = currentSnapshot.getFile(path)
        if (file == null) {
          throw new InvalidChangeError('file not found for hash validation', {
            projectId,
            path,
          })
        }
        await file.load('eager', blobStore)
        const content = file.getContent({ filterTrackedDeletes: true })
        const expectedHash = editOperation.contentHash
        const actualHash = content != null ? getContentHash(content) : null
        logger.debug({ expectedHash, actualHash }, 'validating content hash')
        if (actualHash !== expectedHash) {
          throw new InvalidChangeError('content hash mismatch', {
            projectId,
            path,
            expectedHash,
            actualHash,
          })
        }

        // Remove the content hash from the change before storing it in the chunk.
        // It was only useful for validation.
        editOperation.contentHash = null
      }
    }
  }

  async function extendLastChunkIfPossible() {
    const latestChunk = await chunkStore.loadLatest(projectId)

    currentChunk = latestChunk
    originalEndVersion = latestChunk.getEndVersion()
    if (originalEndVersion !== clientEndVersion) {
      throw new Chunk.ConflictingEndVersion(
        clientEndVersion,
        originalEndVersion
      )
    }

    currentSnapshot = latestChunk.getSnapshot().clone()
    const timer = new Timer()
    currentSnapshot.applyAll(latestChunk.getChanges())

    const changesPushed = await fillChunk(currentChunk, changesToPersist)
    if (!changesPushed) {
      return
    }

    checkElapsedTime(timer)

    await chunkStore.update(projectId, originalEndVersion, currentChunk)
  }

  async function createNewChunksAsNeeded() {
    while (changesToPersist.length > 0) {
      const endVersion = currentChunk.getEndVersion()
      const history = new History(currentSnapshot.clone(), [])
      const chunk = new Chunk(history, endVersion)
      const timer = new Timer()

      const changesPushed = await fillChunk(chunk, changesToPersist)
      if (changesPushed) {
        checkElapsedTime(timer)
        currentChunk = chunk
        await chunkStore.create(projectId, chunk)
      } else {
        throw new Error('failed to fill empty chunk')
      }
    }
  }

  function isOlderThanMinChangeTimestamp(change) {
    return change.getTimestamp().getTime() < limits.minChangeTimestamp
  }

  function isOlderThanMaxChangeTimestamp(change) {
    return change.getTimestamp().getTime() < limits.maxChangeTimestamp
  }

  const oldChanges = _.filter(allChanges, isOlderThanMinChangeTimestamp)
  const anyTooOld = _.some(oldChanges, isOlderThanMaxChangeTimestamp)
  const tooManyChanges = oldChanges.length > limits.maxChanges
  const tooManyBytes = totalChangeBytes(oldChanges) > limits.maxChangeBytes

  if (anyTooOld || tooManyChanges || tooManyBytes) {
    changesToPersist = oldChanges
    const numberOfChangesToPersist = oldChanges.length

    await extendLastChunkIfPossible()
    await createNewChunksAsNeeded()

    return {
      numberOfChangesPersisted: numberOfChangesToPersist,
      originalEndVersion,
      currentChunk,
    }
  } else {
    return null
  }
}

module.exports = persistChanges
