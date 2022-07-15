/**
 * ContentCacheManager - maintains a cache of stream hashes from a PDF file
 */

const { callbackify } = require('util')
const fs = require('fs')
const crypto = require('crypto')
const Path = require('path')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const pLimit = require('p-limit')
const { parseXrefTable } = require('../lib/pdfjs/parseXrefTable')
const { QueueLimitReachedError, TimedOutError } = require('./Errors')
const workerpool = require('workerpool')
const Metrics = require('@overleaf/metrics')

let WORKER_POOL
// NOTE: Check for main thread to avoid recursive start of pool.
if (Settings.pdfCachingEnableWorkerPool && workerpool.isMainThread) {
  WORKER_POOL = workerpool.pool(Path.join(__dirname, 'ContentCacheWorker.js'), {
    // Cap number of worker threads.
    maxWorkers: Settings.pdfCachingWorkerPoolSize,
    // Warmup workers.
    minWorkers: Settings.pdfCachingWorkerPoolSize,
    // Limit queue back-log
    maxQueueSize: Settings.pdfCachingWorkerPoolBackLogLimit,
  })
  setInterval(() => {
    const {
      totalWorkers,
      busyWorkers,
      idleWorkers,
      pendingTasks,
      activeTasks,
    } = WORKER_POOL.stats()
    Metrics.gauge('pdf_caching_total_workers', totalWorkers)
    Metrics.gauge('pdf_caching_busy_workers', busyWorkers)
    Metrics.gauge('pdf_caching_idle_workers', idleWorkers)
    Metrics.gauge('pdf_caching_pending_tasks', pendingTasks)
    Metrics.gauge('pdf_caching_active_tasks', activeTasks)
  }, 15 * 1000)
}

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} size the pdf size
 * @param {number} compileTime
 */
async function update(contentDir, filePath, size, compileTime) {
  if (Settings.pdfCachingEnableWorkerPool) {
    return await updateOtherEventLoop(contentDir, filePath, size, compileTime)
  } else {
    return await updateSameEventLoop(contentDir, filePath, size, compileTime)
  }
}

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} size the pdf size
 * @param {number} compileTime
 */
async function updateOtherEventLoop(contentDir, filePath, size, compileTime) {
  const timeout = getMaxOverhead(compileTime)
  try {
    return await WORKER_POOL.exec('doUpdateInternalNoDeadline', [
      contentDir,
      filePath,
      size,
    ]).timeout(timeout)
  } catch (e) {
    if (e instanceof workerpool.Promise.TimeoutError) {
      throw new TimedOutError('context-lost-in-worker')
    }
    if (e.message.includes('Max queue size of ')) {
      throw new QueueLimitReachedError()
    }
    throw e
  }
}

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} size the pdf size
 * @param {number} compileTime
 */
async function updateSameEventLoop(contentDir, filePath, size, compileTime) {
  const checkDeadline = getDeadlineChecker(compileTime)
  return doUpdateInternal(contentDir, filePath, size, checkDeadline)
}

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} size the pdf size
 */
async function doUpdateInternalNoDeadline(contentDir, filePath, size) {
  return doUpdateInternal(contentDir, filePath, size, () => {})
}
/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} size the pdf size
 * @param {function} checkDeadline
 */
async function doUpdateInternal(contentDir, filePath, size, checkDeadline) {
  const ranges = []
  const newRanges = []
  // keep track of hashes expire old ones when they reach a generation > N.
  const tracker = await HashFileTracker.from(contentDir)
  tracker.updateAge()

  checkDeadline('after init HashFileTracker')

  const { xRefEntries, startXRefTable } = await parseXrefTable(
    filePath,
    size,
    checkDeadline
  )
  xRefEntries.sort((a, b) => {
    return a.offset - b.offset
  })
  xRefEntries.forEach((obj, idx) => {
    obj.idx = idx
  })

  checkDeadline('after parsing')

  const uncompressedObjects = []
  for (const object of xRefEntries) {
    if (!object.uncompressed) {
      continue
    }
    const nextObject = xRefEntries[object.idx + 1]
    if (!nextObject) {
      // Ignore this possible edge case.
      // The last object should be part of the xRef table.
      continue
    } else {
      object.endOffset = nextObject.offset
    }
    const size = object.endOffset - object.offset
    object.size = size
    if (size < Settings.pdfCachingMinChunkSize) {
      continue
    }
    uncompressedObjects.push({ object, idx: uncompressedObjects.length })
  }

  checkDeadline('after finding uncompressed')

  const handle = await fs.promises.open(filePath)
  try {
    for (const { object, idx } of uncompressedObjects) {
      let buffer = Buffer.alloc(object.size, 0)
      const { bytesRead } = await handle.read(
        buffer,
        0,
        object.size,
        object.offset
      )
      checkDeadline('after read ' + idx)
      if (bytesRead !== object.size) {
        throw new OError('could not read full chunk', {
          object,
          bytesRead,
        })
      }
      const idxObj = buffer.indexOf('obj')
      if (idxObj > 100) {
        throw new OError('objectId is too large', {
          object,
          idxObj,
        })
      }
      const objectIdRaw = buffer.subarray(0, idxObj)
      buffer = buffer.subarray(objectIdRaw.byteLength)

      const hash = pdfStreamHash(buffer)
      checkDeadline('after hash ' + idx)
      const range = {
        objectId: objectIdRaw.toString(),
        start: object.offset + objectIdRaw.byteLength,
        end: object.endOffset,
        hash,
      }
      ranges.push(range)

      // Optimization: Skip writing of duplicate streams.
      if (tracker.track(range)) continue

      await writePdfStream(contentDir, hash, buffer)
      checkDeadline('after write ' + idx)
      newRanges.push(range)
    }
  } finally {
    await handle.close()
  }

  // NOTE: Bailing out below does not make sense.
  //       Let the next compile use the already written ranges.
  const reclaimedSpace = await tracker.deleteStaleHashes(5)
  await tracker.flush()
  return [ranges, newRanges, reclaimedSpace, startXRefTable]
}

function getStatePath(contentDir) {
  return Path.join(contentDir, '.state.v0.json')
}

class HashFileTracker {
  constructor(contentDir, { hashAge = [], hashSize = [] }) {
    this.contentDir = contentDir
    this.hashAge = new Map(hashAge)
    this.hashSize = new Map(hashSize)
  }

  static async from(contentDir) {
    const statePath = getStatePath(contentDir)
    let state = {}
    try {
      const blob = await fs.promises.readFile(statePath)
      state = JSON.parse(blob)
    } catch (e) {}
    return new HashFileTracker(contentDir, state)
  }

  track(range) {
    const exists = this.hashAge.has(range.hash)
    if (!exists) {
      this.hashSize.set(range.hash, range.end - range.start)
    }
    this.hashAge.set(range.hash, 0)
    return exists
  }

  updateAge() {
    for (const [hash, age] of this.hashAge) {
      this.hashAge.set(hash, age + 1)
    }
    return this
  }

  findStale(maxAge) {
    const stale = []
    for (const [hash, age] of this.hashAge) {
      if (age > maxAge) {
        stale.push(hash)
      }
    }
    return stale
  }

  async flush() {
    const statePath = getStatePath(this.contentDir)
    const blob = JSON.stringify({
      hashAge: Array.from(this.hashAge.entries()),
      hashSize: Array.from(this.hashSize.entries()),
    })
    const atomicWrite = statePath + '~'
    try {
      await fs.promises.writeFile(atomicWrite, blob)
    } catch (err) {
      try {
        await fs.promises.unlink(atomicWrite)
      } catch (e) {}
      throw err
    }
    try {
      await fs.promises.rename(atomicWrite, statePath)
    } catch (err) {
      try {
        await fs.promises.unlink(atomicWrite)
      } catch (e) {}
      throw err
    }
  }

  async deleteStaleHashes(n) {
    // delete any hash file older than N generations
    const hashes = this.findStale(n)

    let reclaimedSpace = 0
    if (hashes.length === 0) {
      return reclaimedSpace
    }

    await promiseMapWithLimit(10, hashes, async hash => {
      await fs.promises.unlink(Path.join(this.contentDir, hash))
      this.hashAge.delete(hash)
      reclaimedSpace += this.hashSize.get(hash)
      this.hashSize.delete(hash)
    })
    return reclaimedSpace
  }
}

function pdfStreamHash(buffer) {
  const hash = crypto.createHash('sha256')
  hash.update(buffer)
  return hash.digest('hex')
}

async function writePdfStream(dir, hash, buffer) {
  const filename = Path.join(dir, hash)
  const atomicWriteFilename = filename + '~'
  if (Settings.enablePdfCachingDark) {
    // Write an empty file in dark mode.
    buffer = Buffer.alloc(0)
  }
  try {
    await fs.promises.writeFile(atomicWriteFilename, buffer)
    await fs.promises.rename(atomicWriteFilename, filename)
  } catch (err) {
    try {
      await fs.promises.unlink(atomicWriteFilename)
    } catch (_) {
      throw err
    }
  }
}

function getMaxOverhead(compileTime) {
  return Math.min(
    // Adding 10s to a  40s compile time is OK.
    // Adding  1s to a   3s compile time is OK.
    Math.max(compileTime / 4, 1000),
    // Adding 30s to a 120s compile time is not OK, limit to 10s.
    Settings.pdfCachingMaxProcessingTime
  )
}

function getDeadlineChecker(compileTime) {
  const maxOverhead = getMaxOverhead(compileTime)

  const deadline = Date.now() + maxOverhead
  let lastStage = { stage: 'start', now: Date.now() }
  let completedStages = 0
  return function (stage) {
    const now = Date.now()
    if (now > deadline) {
      throw new TimedOutError(stage, {
        completedStages,
        lastStage: lastStage.stage,
        diffToLastStage: now - lastStage.now,
      })
    }
    completedStages++
    lastStage = { stage, now }
  }
}

function promiseMapWithLimit(concurrency, array, fn) {
  const limit = pLimit(concurrency)
  return Promise.all(array.map(x => limit(() => fn(x))))
}

module.exports = {
  HASH_REGEX: /^[0-9a-f]{64}$/,
  update: callbackify(update),
  promises: {
    update,
    doUpdateInternalNoDeadline,
  },
}
