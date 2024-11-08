/**
 * ContentCacheManager - maintains a cache of stream hashes from a PDF file
 */

const { callbackify } = require('node:util')
const fs = require('node:fs')
const crypto = require('node:crypto')
const Path = require('node:path')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const pLimit = require('p-limit')
const { parseXrefTable } = require('./XrefParser')
const {
  QueueLimitReachedError,
  TimedOutError,
  NoXrefTableError,
} = require('./Errors')
const workerpool = require('workerpool')
const Metrics = require('@overleaf/metrics')

/**
 * @type {import('workerpool').WorkerPool}
 */
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
 * @param {number} pdfSize the pdf size
 * @param {number} pdfCachingMinChunkSize per request threshold
 * @param {number} compileTime
 */
async function update({
  contentDir,
  filePath,
  pdfSize,
  pdfCachingMinChunkSize,
  compileTime,
}) {
  if (pdfSize < pdfCachingMinChunkSize) {
    return {
      contentRanges: [],
      newContentRanges: [],
      reclaimedSpace: 0,
      startXRefTable: undefined,
    }
  }
  if (Settings.pdfCachingEnableWorkerPool) {
    return await updateOtherEventLoop({
      contentDir,
      filePath,
      pdfSize,
      pdfCachingMinChunkSize,
      compileTime,
    })
  } else {
    return await updateSameEventLoop({
      contentDir,
      filePath,
      pdfSize,
      pdfCachingMinChunkSize,
      compileTime,
    })
  }
}

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} pdfSize the pdf size
 * @param {number} pdfCachingMinChunkSize per request threshold
 * @param {number} compileTime
 */
async function updateOtherEventLoop({
  contentDir,
  filePath,
  pdfSize,
  pdfCachingMinChunkSize,
  compileTime,
}) {
  const workerLatencyInMs = 100
  // Prefer getting the timeout error from the worker vs timing out the worker.
  const timeout = getMaxOverhead(compileTime) + workerLatencyInMs
  try {
    return await WORKER_POOL.exec('updateSameEventLoop', [
      {
        contentDir,
        filePath,
        pdfSize,
        pdfCachingMinChunkSize,
        compileTime,
      },
    ]).timeout(timeout)
  } catch (e) {
    if (e instanceof workerpool.Promise.TimeoutError) {
      throw new TimedOutError('context-lost-in-worker', { timeout })
    }
    if (e.message?.includes?.('Max queue size of ')) {
      throw new QueueLimitReachedError()
    }
    if (e.message?.includes?.('xref')) {
      throw new NoXrefTableError(e.message)
    }
    throw e
  }
}

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} pdfSize the pdf size
 * @param {number} pdfCachingMinChunkSize per request threshold
 * @param {number} compileTime
 */
async function updateSameEventLoop({
  contentDir,
  filePath,
  pdfSize,
  pdfCachingMinChunkSize,
  compileTime,
}) {
  const checkDeadline = getDeadlineChecker(compileTime)
  // keep track of hashes expire old ones when they reach a generation > N.
  const tracker = await HashFileTracker.from(contentDir)
  tracker.updateAge()
  checkDeadline('after init HashFileTracker')

  const [reclaimedSpace, overheadDeleteStaleHashes] =
    await tracker.deleteStaleHashes(5)
  checkDeadline('after delete stale hashes')

  const { xRefEntries, startXRefTable } = await parseXrefTable(
    filePath,
    pdfSize
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
    if (size < pdfCachingMinChunkSize) {
      continue
    }
    uncompressedObjects.push({ object, idx: uncompressedObjects.length })
  }

  checkDeadline('after finding uncompressed')

  let timedOutErr = null
  const contentRanges = []
  const newContentRanges = []
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

      if (tracker.has(range.hash)) {
        // Optimization: Skip writing of already seen hashes.
        tracker.track(range)
        contentRanges.push(range)
        continue
      }

      await writePdfStream(contentDir, hash, buffer)
      tracker.track(range)
      contentRanges.push(range)
      newContentRanges.push(range)
      checkDeadline('after write ' + idx)
    }
  } catch (err) {
    if (err instanceof TimedOutError) {
      // Let the frontend use ranges that were processed so far.
      timedOutErr = err
    } else {
      throw err
    }
  } finally {
    await handle.close()

    // Flush from both success and failure code path. This allows the next
    //  cycle to complete faster as it can use the already written ranges.
    await tracker.flush()
  }
  return {
    contentRanges,
    newContentRanges,
    reclaimedSpace,
    startXRefTable,
    overheadDeleteStaleHashes,
    timedOutErr,
  }
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

  has(hash) {
    return this.hashAge.has(hash)
  }

  track(range) {
    if (!this.hashSize.has(range.hash)) {
      this.hashSize.set(range.hash, range.end - range.start)
    }
    this.hashAge.set(range.hash, 0)
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
    const t0 = Date.now()
    // delete any hash file older than N generations
    const hashes = this.findStale(n)

    let reclaimedSpace = 0
    if (hashes.length === 0) {
      return [reclaimedSpace, Date.now() - t0]
    }

    await promiseMapWithLimit(10, hashes, async hash => {
      try {
        await fs.promises.unlink(Path.join(this.contentDir, hash))
      } catch (err) {
        if (err?.code === 'ENOENT') {
          // Ignore already deleted entries. The previous cleanup cycle may have
          //  been killed halfway through the deletion process, or before we
          //  flushed the state to disk.
        } else {
          throw err
        }
      }
      this.hashAge.delete(hash)
      reclaimedSpace += this.hashSize.get(hash)
      this.hashSize.delete(hash)
    })
    return [reclaimedSpace, Date.now() - t0]
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
  const timeout = getMaxOverhead(compileTime)

  const deadline = Date.now() + timeout
  let lastStage = { stage: 'start', now: Date.now() }
  let completedStages = 0
  return function (stage) {
    const now = Date.now()
    if (now > deadline) {
      throw new TimedOutError(stage, {
        timeout,
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
    updateSameEventLoop,
  },
}
