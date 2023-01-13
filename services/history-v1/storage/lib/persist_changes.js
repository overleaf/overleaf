/** @module */
'use strict'

const _ = require('lodash')
const BPromise = require('bluebird')

const core = require('overleaf-editor-core')
const Chunk = core.Chunk
const History = core.History

const assert = require('./assert')
const chunkStore = require('./chunk_store')

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
 * @param {Array.<Change>} allChanges
 * @param {Object} limits
 * @param {number} clientEndVersion
 * @return {Promise.<Object?>}
 */
module.exports = function persistChanges(
  projectId,
  allChanges,
  limits,
  clientEndVersion
) {
  assert.projectId(projectId)
  assert.array(allChanges)
  assert.maybe.object(limits)
  assert.integer(clientEndVersion)

  let currentChunk
  // currentSnapshot tracks the latest change that we're applying; we use it to
  // check that the changes we are persisting are valid.
  let currentSnapshot
  let originalEndVersion
  let changesToPersist

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

  function fillChunk(chunk, changes) {
    let totalBytes = totalChangeBytes(chunk.getChanges())
    let changesPushed = false
    while (changes.length > 0) {
      if (chunk.getChanges().length >= limits.maxChunkChanges) break
      const changeBytes = countChangeBytes(changes[0])
      if (totalBytes + changeBytes > limits.maxChunkChangeBytes) break
      const changesToFill = changes.splice(0, 1)
      currentSnapshot.applyAll(changesToFill, { strict: true })
      chunk.pushChanges(changesToFill)
      totalBytes += changeBytes
      changesPushed = true
    }
    return changesPushed
  }

  function extendLastChunkIfPossible() {
    return chunkStore.loadLatest(projectId).then(function (latestChunk) {
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

      if (!fillChunk(currentChunk, changesToPersist)) return
      checkElapsedTime(timer)

      return chunkStore.update(projectId, originalEndVersion, currentChunk)
    })
  }

  function createNewChunksAsNeeded() {
    if (changesToPersist.length === 0) return

    const endVersion = currentChunk.getEndVersion()
    const history = new History(currentSnapshot.clone(), [])
    const chunk = new Chunk(history, endVersion)
    const timer = new Timer()
    if (fillChunk(chunk, changesToPersist)) {
      checkElapsedTime(timer)
      currentChunk = chunk
      return chunkStore.create(projectId, chunk).then(createNewChunksAsNeeded)
    }
    throw new Error('failed to fill empty chunk')
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
    return extendLastChunkIfPossible()
      .then(createNewChunksAsNeeded)
      .then(function () {
        return {
          numberOfChangesPersisted: numberOfChangesToPersist,
          originalEndVersion,
          currentChunk,
        }
      })
  }
  return BPromise.resolve(null)
}
