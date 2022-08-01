import OError from '@overleaf/o-error'

const PDF_JS_CHUNK_SIZE = 128 * 1024
const MAX_SUB_REQUEST_COUNT = 4
const MAX_SUB_REQUEST_BYTES = 4 * PDF_JS_CHUNK_SIZE
const HEADER_OVERHEAD_PER_MULTI_PART_CHUNK = 100
const MULTI_PART_THRESHOLD = 4
const INCREMENTAL_CACHE_SIZE = 1000
// Download large chunks once the shard bandwidth exceeds 50% of their size.
const CHUNK_USAGE_THRESHOLD_PREFETCH_LARGE = 0.5
// Preferred caching once we downloaded a chunk (in multiple shards) in full.
const CHUNK_USAGE_THRESHOLD_TRIGGER_PREFERRED = 1
const CHUNK_USAGE_THRESHOLD_CACHED = 42
// 42 * 0.7^11 < 1, aka we keep stale entries around for 11 compiles.
const CHUNK_USAGE_STALE_DECAY_RATE = 0.7

/**
 * @param {Object} file
 */
function backfillEdgeBounds(file) {
  const encoder = new TextEncoder()
  for (const chunk of file.ranges) {
    if (chunk.objectId) {
      chunk.objectId = encoder.encode(chunk.objectId)
      chunk.start -= chunk.objectId.byteLength
      chunk.size = chunk.end - chunk.start
    }
  }
}

/**
 * @param {Map} usageScore
 * @param {Map} cachedUrls
 */
function trimState({ usageScore, cachedUrls }) {
  for (const hash of usageScore) {
    if (usageScore.size < INCREMENTAL_CACHE_SIZE) {
      break
    }
    const score = usageScore.get(hash)
    if (score >= CHUNK_USAGE_THRESHOLD_TRIGGER_PREFERRED) {
      // Keep entries that are worth caching around for longer.
      usageScore.set(hash, score * CHUNK_USAGE_STALE_DECAY_RATE)
      continue
    }
    cachedUrls.delete(hash)
    usageScore.delete(hash)
  }
}

/**
 * @param {Object} file
 * @param {Map} usageScore
 * @param {Map} cachedUrls
 */
function preprocessFileOnce({ file, usageScore, cachedUrls }) {
  if (file.preprocessed) return
  file.preprocessed = true

  file.createdAt = new Date(file.createdAt)
  file.prefetched = file.prefetched || []
  trimState({ usageScore, cachedUrls })
  backfillEdgeBounds(file)
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
  const { size, objectId } = chunk
  const header = Uint8Array.from(objectId)
  const fullBuffer = new Uint8Array(size)
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
 * @param {Object} a
 * @param {Object} b
 */
function sortBySizeDESC(a, b) {
  return a.size > b.size ? -1 : 1
}

/**
 * @param {Object} a
 * @param {Object} b
 */
function sortByStartASC(a, b) {
  return a.start > b.start ? 1 : -1
}

/**
 * @param {Object} chunk
 */
function usageAboveThreshold(chunk) {
  // We fetched enough shards of this chunk. Cache it in full now.
  return chunk.totalUsage > CHUNK_USAGE_THRESHOLD_TRIGGER_PREFERRED
}

/**
 * @param {Array} potentialChunks
 * @param {Map} usageScore
 * @param {Map} cachedUrls
 * @param {Object} metrics
 * @param {number} start
 * @param {number} end
 * @param {boolean} prefetchLargeEnabled
 */
function cutRequestAmplification({
  potentialChunks,
  usageScore,
  cachedUrls,
  metrics,
  start,
  end,
  prefetchLargeEnabled,
}) {
  // NOTE: Map keys are stored in insertion order.
  // We re-insert keys on cache hit and turn 'usageScore' into a cheap LRU.

  const chunks = []
  const skipAlreadyAdded = chunk => !chunks.includes(chunk)
  let tooManyRequests = false
  let tooMuchBandwidth = false
  let newChunks = 0
  let newCacheBandwidth = 0
  for (const chunk of potentialChunks) {
    const newUsage =
      (Math.min(end, chunk.end) - Math.max(start, chunk.start)) / chunk.size
    const totalUsage = (usageScore.get(chunk.hash) || 0) + newUsage
    usageScore.delete(chunk.hash)
    usageScore.set(chunk.hash, totalUsage)
    chunk.totalUsage = totalUsage
  }

  // Always download already cached entries
  for (const chunk of potentialChunks) {
    if (chunk.totalUsage >= CHUNK_USAGE_THRESHOLD_CACHED) {
      chunks.push(chunk)
    }
  }

  // Prefer large blobs over small ones.
  potentialChunks.sort(sortBySizeDESC)

  // Prefer chunks with high (previous) usage over brand-new chunks.
  const firstComeFirstCache = () => true
  for (const trigger of [usageAboveThreshold, firstComeFirstCache]) {
    for (const chunk of potentialChunks.filter(skipAlreadyAdded)) {
      if (newCacheBandwidth + chunk.size > MAX_SUB_REQUEST_BYTES) {
        // We would breach the bandwidth amplification limit.
        tooMuchBandwidth = true
        continue
      }
      if (newChunks + 1 > MAX_SUB_REQUEST_COUNT) {
        // We would breach the request rate amplification limit.
        tooManyRequests = true
        continue
      }
      if (trigger(chunk)) {
        newCacheBandwidth += chunk.size
        newChunks += 1
        chunks.push(chunk)
      }
    }
  }
  const largeChunk = potentialChunks.filter(skipAlreadyAdded)[0]
  if (largeChunk?.size >= PDF_JS_CHUNK_SIZE) {
    // This is a large chunk that exceeds the bandwidth amplification limit.
    if (largeChunk.start <= start && largeChunk.end >= end) {
      // This is a large chunk spanning the entire range. pdf.js will only
      //  request these in case it needs the underlying stream, so it is OK to
      //  download as much data as the stream is large in one go.
      chunks.push(largeChunk)
    } else if (
      prefetchLargeEnabled &&
      largeChunk.totalUsage > CHUNK_USAGE_THRESHOLD_PREFETCH_LARGE
    ) {
      // pdf.js actually wants the smaller (dynamic) chunk in the range that
      //  happens to sit right next to this large chunk.
      // pdf.js has requested a lot of the large chunk via shards by now, and it
      //  is time to download it in full to stop "wasting" more bandwidth and
      //  more importantly cut down latency as we can prefetch the small chunk.
      chunks.push(largeChunk)
    }
  }
  if (tooManyRequests) {
    metrics.tooManyRequestsCount++
  }
  if (tooMuchBandwidth) {
    metrics.tooMuchBandwidthCount++
  }

  chunks.sort(sortByStartASC)
  return chunks
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
  const encoder = new TextEncoder()
  for (const chunk of chunks) {
    const header = `\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Range: bytes ${
      chunk.start
    }-${chunk.end - 1}/${file.size}\r\n\r\n`
    const headerSize = header.length

    // Verify header content. A proxy might have tampered with it.
    const headerRaw = encoder.encode(header)
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
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${end - 1}` },
      signal: abortSignal,
    })
    checkChunkResponse(response)
    return await response.arrayBuffer()
  } catch (e) {
    throw OError.tag(e, 'fallback request failed', { url, start, end })
  }
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
 * @param {Array} chunks
 * @param {Array} prefetched
 * @param {number} start
 * @param {number} end
 */
function skipPrefetched(chunks, prefetched, start, end) {
  return chunks.filter(chunk => {
    return !prefetched.find(
      c =>
        c.start <= Math.max(chunk.start, start) &&
        c.end >= Math.min(chunk.end, end)
    )
  })
}

/**
 * @param {Object} chunk
 * @param {string} url
 * @param {Object} init
 * @param {Map<string, string>} cachedUrls
 * @param {Object} metrics
 * @param {boolean} cachedUrlLookupEnabled
 */
async function fetchChunk({
  chunk,
  url,
  init,
  cachedUrls,
  metrics,
  cachedUrlLookupEnabled,
}) {
  const oldUrl = cachedUrls.get(chunk.hash)
  if (cachedUrlLookupEnabled && chunk.hash && oldUrl && oldUrl !== url) {
    // When the clsi server id changes, the content id changes too and as a
    //  result all the browser cache keys (aka urls) get invalidated.
    // We memorize the previous browser cache keys in `cachedUrls`.
    try {
      const response = await fetch(oldUrl, init)
      if (response.status === 200) {
        metrics.oldUrlHitCount += 1
        return response
      }
      if (response.status === 404) {
        // The old browser cache entry is gone and the old file is gone too.
        metrics.oldUrlMissCount += 1
      }
      // Fallback to the latest url.
    } catch (e) {
      // Fallback to the latest url.
    }
  }
  const response = await fetch(url, init)
  checkChunkResponse(response)
  if (chunk.hash) cachedUrls.set(chunk.hash, url)
  return response
}

/**
 * @param {Object} file
 * @param {number} start
 * @param {number} end
 * @param {Array} dynamicChunks
 * @param {boolean} prefetchXRefTable
 * @param {number} startXRefTableRange
 */
function addPrefetchingChunks({
  file,
  start,
  end,
  dynamicChunks,
  prefetchXRefTable,
  startXRefTableRange,
}) {
  // Prefetch in case this is the first range, or we are fetching dynamic
  //  chunks anyway (so we can ride-share the round trip).
  // Rendering cannot start without downloading the xref table, so it's OK to
  //  "delay" the first range.
  if (!(start === 0 || dynamicChunks.length > 0)) {
    return
  }

  let extra = []
  if (prefetchXRefTable) {
    // Prefetch the dynamic chunks around the xref table.
    extra = skipPrefetched(
      getInterleavingDynamicChunks(
        getMatchingChunks(file.ranges, startXRefTableRange, file.size),
        startXRefTableRange,
        file.size
      ),
      file.prefetched,
      startXRefTableRange,
      file.size
    )
  }
  // Stop at the xref table range if present -- we may prefetch it early ^^^.
  const prefetchEnd = startXRefTableRange || file.size
  extra = extra.concat(
    skipPrefetched(
      getInterleavingDynamicChunks(
        getMatchingChunks(file.ranges, end, prefetchEnd),
        end,
        prefetchEnd
      ),
      file.prefetched,
      end,
      prefetchEnd
    )
  )

  let sum =
    countBytes(dynamicChunks) +
    HEADER_OVERHEAD_PER_MULTI_PART_CHUNK * dynamicChunks.length
  for (const chunk of extra) {
    sum += chunk.end - chunk.start + HEADER_OVERHEAD_PER_MULTI_PART_CHUNK
    if (sum > PDF_JS_CHUNK_SIZE) {
      // Stop prefetching when the range is full.
    }
    const sibling = dynamicChunks.find(
      sibling => sibling.end === chunk.start || sibling.start === chunk.end
    )
    if (sibling) {
      // Just expand the chunk.
      sibling.start = Math.min(sibling.start, chunk.start)
      sibling.end = Math.max(sibling.end, chunk.end)
      continue
    }
    if (dynamicChunks.length === MULTI_PART_THRESHOLD) {
      // Stop prefetching when we would switch to a multipart request.
      // (We continue in case we are already doing a multipart request.)
      break
    }
    dynamicChunks.push(chunk)
  }
  dynamicChunks.sort(sortByStartASC)
}

/**
 *
 * @param {string} url
 * @param {number} start
 * @param {number} end
 * @param {Object} file
 * @param {Object} metrics
 * @param {Map} usageScore
 * @param {Map} cachedUrls
 * @param {boolean} verifyChunks
 * @param {boolean} prefetchingEnabled
 * @param {boolean} prefetchLargeEnabled
 * @param {boolean} tryOldCachedUrlEnabled
 * @param {AbortSignal} abortSignal
 */
export async function fetchRange({
  url,
  start,
  end,
  file,
  metrics,
  usageScore,
  cachedUrls,
  verifyChunks,
  prefetchingEnabled,
  prefetchLargeEnabled,
  cachedUrlLookupEnabled,
  abortSignal,
}) {
  preprocessFileOnce({ file, usageScore, cachedUrls })
  const startXRefTableRange =
    Math.floor(file.startXRefTable / PDF_JS_CHUNK_SIZE) * PDF_JS_CHUNK_SIZE
  const prefetchXRefTable = startXRefTableRange > 0 && start === 0
  const prefetched = getMatchingChunks(file.prefetched, start, end)

  // Check that handling the range request won't trigger excessive sub-requests,
  // (to avoid unwanted latency compared to the original request).
  const chunks = cutRequestAmplification({
    potentialChunks: skipPrefetched(
      getMatchingChunks(file.ranges, start, end),
      prefetched,
      start,
      end
    ),
    usageScore,
    cachedUrls,
    metrics,
    start,
    end,
    prefetchLargeEnabled,
  })
  const dynamicChunks = skipPrefetched(
    getInterleavingDynamicChunks(chunks, start, end),
    prefetched,
    start,
    end
  )
  const size = end - start

  if (
    chunks.length === 0 &&
    prefetched.length === 0 &&
    dynamicChunks.length === 1 &&
    !prefetchXRefTable
  ) {
    // fall back to the original range request when no chunks are cached.
    // Exception: The first range should fetch the xref table as well.
    trackDownloadStats(metrics, {
      size,
      cachedCount: 0,
      cachedBytes: 0,
      fetchedCount: 1,
      fetchedBytes: size,
    })
    return fallbackRequest({ url, start, end, abortSignal })
  }

  if (prefetchingEnabled) {
    addPrefetchingChunks({
      file,
      start,
      end,
      dynamicChunks,
      prefetchXRefTable,
      startXRefTableRange,
    })
  }

  const byteRanges = dynamicChunks
    .map(chunk => `${chunk.start}-${chunk.end - 1}`)
    .join(',')
  const coalescedDynamicChunks = []
  switch (true) {
    case dynamicChunks.length === 0:
      break
    case dynamicChunks.length === 1:
      coalescedDynamicChunks.push({
        chunk: dynamicChunks[0],
        url,
        init: { headers: { Range: `bytes=${byteRanges}` } },
      })
      break
    case dynamicChunks.length <= MULTI_PART_THRESHOLD:
      // There will always be an OPTIONS request for multi-ranges requests.
      // It is faster to request few ranges in parallel instead of waiting for
      //  the OPTIONS request to round trip.
      dynamicChunks.forEach(chunk => {
        coalescedDynamicChunks.push({
          chunk,
          url,
          init: { headers: { Range: `bytes=${chunk.start}-${chunk.end - 1}` } },
        })
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
        const response = await fetchChunk({
          chunk,
          url,
          init: { ...init, signal: abortSignal },
          cachedUrls,
          metrics,
          cachedUrlLookupEnabled,
        })
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
            usageScore.delete(chunk.hash)
            usageScore.set(chunk.hash, CHUNK_USAGE_THRESHOLD_CACHED)
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
    .concat(prefetched.map(chunk => ({ chunk, data: chunk.buffer })))
    .forEach(({ chunk, data }) => {
      if (!chunk.hash && chunk.end > end) {
        // This is a (partially) prefetched chunk.
        chunk.buffer = data
        file.prefetched.push(chunk)
        if (chunk.start > end) return // This is a fully prefetched chunk.
      }
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
