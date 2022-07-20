import OError from '@overleaf/o-error'

const PDF_JS_CHUNK_SIZE = 128 * 1024
const MAX_SUB_REQUEST_COUNT = 4
const MAX_SUB_REQUEST_BYTES = 4 * PDF_JS_CHUNK_SIZE
const INCREMENTAL_CACHE_SIZE = 1000

const ENCODER = new TextEncoder()
function backfillEdgeBounds(file) {
  if (!file.backfilledEdgeBoundsOnce) {
    for (const range of file.ranges) {
      if (range.objectId) {
        range.objectId = ENCODER.encode(range.objectId)
        range.start -= range.objectId.byteLength
      }
    }
  }
  file.backfilledEdgeBoundsOnce = true
}

/**
 * @param {Array} chunks
 */
function countBytes(chunks) {
  return chunks.reduce((totalBytes, chunk) => {
    return totalBytes + (chunk.end - chunk.start)
  }, 0)
}

/**
 *
 * @param {Object} metrics
 * @param {number} size
 * @param {number} cachedCount
 * @param {number} cachedBytes
 * @param {number} fetchedCount
 * @param {number} fetchedBytes
 */
function trackDownloadStats(
  metrics,
  { size, cachedCount, cachedBytes, fetchedCount, fetchedBytes }
) {
  metrics.cachedCount += cachedCount
  metrics.cachedBytes += cachedBytes
  metrics.fetchedCount += fetchedCount
  metrics.fetchedBytes += fetchedBytes
  metrics.requestedCount++
  metrics.requestedBytes += size
}

/**
 * @param {Object} metrics
 * @param {boolean} sizeDiffers
 * @param {boolean} mismatch
 * @param {boolean} success
 */
function trackChunkVerify(metrics, { sizeDiffers, mismatch, success }) {
  if (sizeDiffers) {
    metrics.chunkVerifySizeDiffers |= 0
    metrics.chunkVerifySizeDiffers += 1
  }
  if (mismatch) {
    metrics.chunkVerifyMismatch |= 0
    metrics.chunkVerifyMismatch += 1
  }
  if (success) {
    metrics.chunkVerifySuccess |= 0
    metrics.chunkVerifySuccess += 1
  }
}

/**
 * @param chunk
 * @param {ArrayBuffer} arrayBuffer
 * @return {Uint8Array}
 */
function backFillObjectContext(chunk, arrayBuffer) {
  if (!chunk.objectId) {
    // This is a dynamic chunk
    return new Uint8Array(arrayBuffer)
  }
  const { start, end, objectId } = chunk
  const header = Uint8Array.from(objectId)
  const fullBuffer = new Uint8Array(end - start)
  fullBuffer.set(header, 0)
  fullBuffer.set(new Uint8Array(arrayBuffer), objectId.length)
  return fullBuffer
}

/**
 * @param {Array} chunks
 * @param {number} start
 * @param {number} end
 * @returns {Array}
 */
function getMatchingChunks(chunks, start, end) {
  const matchingChunks = []
  for (const chunk of chunks) {
    if (chunk.end <= start) {
      // no overlap:
      //             | REQUESTED_RANGE |
      //  | CHUNK |
      continue
    }
    if (chunk.start >= end) {
      // no overlap:
      //  | REQUESTED_RANGE |
      //                      | CHUNK |
      break
    }
    matchingChunks.push(chunk)
  }
  return matchingChunks
}

/**
 * @param {Array} potentialChunks
 * @param {Set} cached
 * @param {Object} metrics
 */
function cutRequestAmplification(potentialChunks, cached, metrics) {
  const chunks = []
  const newChunks = []
  let tooManyRequests = false
  for (const chunk of potentialChunks) {
    if (cached.has(chunk.hash)) {
      chunks.push(chunk)
      continue
    }
    if (newChunks.length < MAX_SUB_REQUEST_COUNT) {
      chunks.push(chunk)
      newChunks.push(chunk)
    } else {
      tooManyRequests = true
    }
  }
  if (tooManyRequests) {
    metrics.tooManyRequestsCount++
  }
  if (cached.size > INCREMENTAL_CACHE_SIZE) {
    for (const key of cached) {
      if (cached.size < INCREMENTAL_CACHE_SIZE) {
        break
      }
      // Map keys are stored in insertion order.
      // We re-insert keys on cache hit, 'cached' is a cheap LRU.
      cached.delete(key)
    }
  }
  return { chunks, newChunks }
}

/**
 * @param {Array} chunks
 * @param {number} start
 * @param {number} end
 * @returns {Array}
 */
function getInterleavingDynamicChunks(chunks, start, end) {
  const dynamicChunks = []
  for (const chunk of chunks) {
    if (start < chunk.start) {
      dynamicChunks.push({ start, end: chunk.start })
    }
    start = chunk.end
  }

  if (start < end) {
    dynamicChunks.push({ start, end })
  }
  return dynamicChunks
}

/**
 *
 * @param {Response} response
 */
function getServerTime(response) {
  const raw = response.headers.get('Date')
  if (!raw) return new Date()
  return new Date(raw)
}

/**
 *
 * @param {Response} response
 */
function getResponseSize(response) {
  const raw = response.headers.get('Content-Length')
  if (!raw) return 0
  return parseInt(raw, 10)
}

/**
 *
 * @param {Response} response
 * @param chunk
 */
function getMultipartBoundary(response, chunk) {
  if (!Array.isArray(chunk)) return ''

  const raw = response.headers.get('Content-Type')
  if (raw.includes('multipart/byteranges')) {
    const idx = raw.indexOf('boundary=')
    if (idx !== -1) return raw.slice(idx + 'boundary='.length)
  }

  throw new OError('missing boundary on multipart request', {
    headers: Object.fromEntries(response.headers.entries()),
    chunk,
  })
}

/**
 * @param {Object} file
 * @param {Array} chunks
 * @param {Uint8Array} data
 * @param {string} boundary
 * @param {Object} metrics
 */
function resolveMultiPartResponses({ file, chunks, data, boundary, metrics }) {
  const responses = []
  let offsetStart = 0
  for (const chunk of chunks) {
    const header = `\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Range: bytes ${
      chunk.start
    }-${chunk.end - 1}/${file.size}\r\n\r\n`
    const headerSize = header.length

    // Verify header content. A proxy might have tampered with it.
    const headerRaw = ENCODER.encode(header)
    if (
      !data
        .subarray(offsetStart, offsetStart + headerSize)
        .every((v, idx) => v === headerRaw[idx])
    ) {
      metrics.headerVerifyFailure |= 0
      metrics.headerVerifyFailure++
      throw new OError('multipart response header does not match', {
        actual: new TextDecoder().decode(
          data.subarray(offsetStart, offsetStart + headerSize)
        ),
        expected: header,
      })
    }

    offsetStart += headerSize
    const chunkSize = chunk.end - chunk.start
    responses.push({
      chunk,
      data: data.subarray(offsetStart, offsetStart + chunkSize),
    })
    offsetStart += chunkSize
  }
  return responses
}

/**
 *
 * @param {Response} response
 */
function checkChunkResponse(response) {
  if (!(response.status === 206 || response.status === 200)) {
    throw new OError('non successful response status: ' + response.status)
  }
}

/**
 *
 * @param {string} url
 * @param {number} start
 * @param {number} end
 * @param {AbortSignal} abortSignal
 */
export async function fallbackRequest({ url, start, end, abortSignal }) {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end - 1}` },
    signal: abortSignal,
  })
  checkChunkResponse(response)
  return response.arrayBuffer()
}

/**
 *
 * @param {string} url
 * @param {number} start
 * @param {number} end
 * @param {Object} metrics
 * @param {Uint8Array} actual
 * @param {AbortSignal} abortSignal
 */
async function verifyRange({ url, start, end, metrics, actual, abortSignal }) {
  let expectedRaw
  try {
    expectedRaw = await fallbackRequest({ url, start, end, abortSignal })
  } catch (error) {
    throw OError.tag(error, 'cannot verify range', { url, start, end })
  }
  const expected = new Uint8Array(expectedRaw)
  const stats = {}
  if (actual.byteLength !== expected.byteLength) {
    stats.sizeDiffers = true
  } else if (!expected.every((v, idx) => v === actual[idx])) {
    stats.mismatch = true
  } else {
    stats.success = true
  }
  trackChunkVerify(metrics, stats)
  return expected
}

/**
 *
 * @param {string} url
 * @param {number} start
 * @param {number} end
 * @param {Object} file
 * @param {Object} metrics
 * @param {Set} cached
 * @param {boolean} verifyChunks
 * @param {AbortSignal} abortSignal
 */
export async function fetchRange({
  url,
  start,
  end,
  file,
  metrics,
  cached,
  verifyChunks,
  abortSignal,
}) {
  file.createdAt = new Date(file.createdAt)
  backfillEdgeBounds(file)

  // Check that handling the range request won't trigger excessive sub-requests,
  // (to avoid unwanted latency compared to the original request).
  const { chunks, newChunks } = cutRequestAmplification(
    getMatchingChunks(file.ranges, start, end),
    cached,
    metrics
  )
  const dynamicChunks = getInterleavingDynamicChunks(chunks, start, end)
  const chunksSize = countBytes(newChunks)
  const size = end - start

  if (chunks.length === 0 && dynamicChunks.length === 1) {
    // fall back to the original range request when no chunks are cached.
    trackDownloadStats(metrics, {
      size,
      cachedCount: 0,
      cachedBytes: 0,
      fetchedCount: 1,
      fetchedBytes: size,
    })
    return fallbackRequest({ url, start, end, abortSignal })
  }
  if (
    chunksSize > MAX_SUB_REQUEST_BYTES &&
    !(dynamicChunks.length === 0 && newChunks.length <= 1)
  ) {
    // fall back to the original range request when a very large amount of
    // object data would be requested, unless it is the only object in the
    // request or everything is already cached.
    metrics.tooLargeOverheadCount++
    trackDownloadStats(metrics, {
      size,
      cachedCount: 0,
      cachedBytes: 0,
      fetchedCount: 1,
      fetchedBytes: size,
    })
    return fallbackRequest({ url, start, end, abortSignal })
  }

  const byteRanges = dynamicChunks
    .map(chunk => `${chunk.start}-${chunk.end - 1}`)
    .join(',')
  const coalescedDynamicChunks = []
  switch (dynamicChunks.length) {
    case 0:
      break
    case 1:
      coalescedDynamicChunks.push({
        chunk: dynamicChunks[0],
        url,
        init: { headers: { Range: `bytes=${byteRanges}` } },
      })
      break
    default:
      coalescedDynamicChunks.push({
        chunk: dynamicChunks,
        url,
        init: { headers: { Range: `bytes=${byteRanges}` } },
      })
  }

  const params = new URL(url).searchParams
  // drop no needed params
  params.delete('enable_pdf_caching')
  params.delete('verify_chunks')
  const query = params.toString()
  // The schema of `url` is https://domain/project/:id/user/:id/build/... for
  //  authenticated and https://domain/project/:id/build/... for
  //  unauthenticated users. Cut it before /build/.
  // The path may have an optional /zone/b prefix too.
  const perUserPrefix = url.slice(0, url.indexOf('/build/'))
  const requests = chunks
    .map(chunk => ({
      chunk,
      url: `${perUserPrefix}/content/${file.contentId}/${chunk.hash}?${query}`,
      init: {},
    }))
    .concat(coalescedDynamicChunks)
  let cachedCount = 0
  let cachedBytes = 0
  let fetchedCount = 0
  let fetchedBytes = 0
  const reassembledBlob = new Uint8Array(size)

  const rawResponses = await Promise.all(
    requests.map(async ({ chunk, url, init }) => {
      try {
        const response = await fetch(url, { ...init, signal: abortSignal })
        checkChunkResponse(response)
        const boundary = getMultipartBoundary(response, chunk)
        const blobFetchDate = getServerTime(response)
        const blobSize = getResponseSize(response)
        if (blobFetchDate && blobSize) {
          // Example: 2MB PDF, 1MB image, 128KB PDF.js chunk.
          //     | pdf.js chunk |
          //   | A BIG IMAGE BLOB |
          // |     THE     FULL     PDF     |
          if (chunk.hash && blobFetchDate < file.createdAt) {
            const usedChunkSection =
              Math.min(end, chunk.end) - Math.max(start, chunk.start)
            cachedCount++
            cachedBytes += usedChunkSection
            // Roll the position of the hash in the Map.
            cached.delete(chunk.hash)
            cached.add(chunk.hash)
          } else {
            // Blobs are fetched in bulk, record the full size.
            fetchedCount++
            fetchedBytes += blobSize
          }
        }
        const data = backFillObjectContext(chunk, await response.arrayBuffer())
        if (!Array.isArray(chunk)) {
          return [{ chunk, data }]
        }
        return resolveMultiPartResponses({
          file,
          chunks: chunk,
          data,
          boundary,
          metrics,
        })
      } catch (err) {
        throw OError.tag(err, 'cannot fetch chunk', { chunk, url, init })
      }
    })
  )

  rawResponses
    .flat() // flatten after splitting multipart responses
    .forEach(({ chunk, data }) => {
      // overlap:
      //     | REQUESTED_RANGE |
      //  | CHUNK |
      const offsetStart = Math.max(start - chunk.start, 0)
      // overlap:
      //     | REQUESTED_RANGE |
      //                   | CHUNK |
      const offsetEnd = Math.max(chunk.end - end, 0)
      if (offsetStart > 0 || offsetEnd > 0) {
        // compute index positions for slice to handle case where offsetEnd=0
        const chunkSize = chunk.end - chunk.start
        data = data.subarray(offsetStart, chunkSize - offsetEnd)
      }
      const insertPosition = Math.max(chunk.start - start, 0)
      reassembledBlob.set(data, insertPosition)
    })

  trackDownloadStats(metrics, {
    size,
    cachedCount,
    cachedBytes,
    fetchedCount,
    fetchedBytes,
  })

  if (verifyChunks) {
    return await verifyRange({
      url,
      start,
      end,
      metrics,
      actual: reassembledBlob,
      abortSignal,
    })
  }
  return reassembledBlob
}
