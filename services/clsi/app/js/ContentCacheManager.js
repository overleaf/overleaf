/**
 * ContentCacheManager - maintains a cache of stream hashes from a PDF file
 */

const { callbackify } = require('util')
const fs = require('fs')
const crypto = require('crypto')
const Path = require('path')
const Settings = require('settings-sharelatex')
const OError = require('@overleaf/o-error')
const pLimit = require('p-limit')
const { parseXrefTable } = require('../lib/pdfjs/parseXrefTable')

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 * @param {number} size the pdf size
 */
async function update(contentDir, filePath, size) {
  const ranges = []
  const newRanges = []
  // keep track of hashes expire old ones when they reach a generation > N.
  const tracker = await HashFileTracker.from(contentDir)
  tracker.updateAge()

  const rawTable = await parseXrefTable(filePath, size)
  rawTable.sort((a, b) => {
    return a.offset - b.offset
  })
  rawTable.forEach((obj, idx) => {
    obj.idx = idx
  })

  const uncompressedObjects = []
  for (const object of rawTable) {
    if (!object.uncompressed) {
      continue
    }
    const nextObject = rawTable[object.idx + 1]
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
    uncompressedObjects.push(object)
  }

  const handle = await fs.promises.open(filePath)
  try {
    for (const object of uncompressedObjects) {
      let buffer = Buffer.alloc(object.size, 0)
      const { bytesRead } = await handle.read(
        buffer,
        0,
        object.size,
        object.offset
      )
      if (bytesRead !== object.size) {
        throw new OError('could not read full chunk', {
          object,
          bytesRead
        })
      }
      const idxObj = buffer.indexOf('obj')
      if (idxObj > 100) {
        throw new OError('objectId is too large', {
          object,
          idxObj
        })
      }
      const objectIdRaw = buffer.subarray(0, idxObj)
      buffer = buffer.subarray(objectIdRaw.byteLength)

      const hash = pdfStreamHash(buffer)
      const range = {
        objectId: objectIdRaw.toString(),
        start: object.offset + objectIdRaw.byteLength,
        end: object.endOffset,
        hash
      }
      ranges.push(range)

      // Optimization: Skip writing of duplicate streams.
      if (tracker.track(range)) continue

      await writePdfStream(contentDir, hash, buffer)
      newRanges.push(range)
    }
  } finally {
    await handle.close()
  }

  const reclaimedSpace = await tracker.deleteStaleHashes(5)
  await tracker.flush()
  return [ranges, newRanges, reclaimedSpace]
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
      hashSize: Array.from(this.hashSize.entries())
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

    await promiseMapWithLimit(10, hashes, async (hash) => {
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

function promiseMapWithLimit(concurrency, array, fn) {
  const limit = pLimit(concurrency)
  return Promise.all(array.map((x) => limit(() => fn(x))))
}

module.exports = {
  HASH_REGEX: /^[0-9a-f]{64}$/,
  update: callbackify(update),
  promises: {
    update
  }
}
