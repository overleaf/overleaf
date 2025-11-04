import {
  Chunk,
  PartiallyProcessedPDFFile,
  PDFRange,
  PrefetchedChunk,
  ProcessedPDFFile,
} from '@ol-types/compile'
import OError from '@overleaf/o-error'
import { PdfCachingMetricsFull } from './types'

const PDF_JS_CHUNK_SIZE = 128 * 1024
const MAX_SUB_REQUEST_COUNT = 4
const MAX_SUB_REQUEST_BYTES = 4 * PDF_JS_CHUNK_SIZE
const SAMPLE_NGINX_BOUNDARY = '00000000000000000001'
export const HEADER_OVERHEAD_PER_MULTI_PART_CHUNK = composeMultipartHeader({
  boundary: SAMPLE_NGINX_BOUNDARY,
  // Assume an upper bound of O(9GB) for the pdf size.
  start: 9 * 1024 * 1024 * 1024,
  end: 9 * 1024 * 1024 * 1024,
  size: 9 * 1024 * 1024 * 1024,
}).length
const MULTI_PART_THRESHOLD = 4
const INCREMENTAL_CACHE_SIZE = 1000
// Download large chunks once the shard bandwidth exceeds 50% of their size.
const CHUNK_USAGE_THRESHOLD_PREFETCH_LARGE = 0.5
// Preferred caching once we downloaded a chunk (in multiple shards) in full.
const CHUNK_USAGE_THRESHOLD_TRIGGER_PREFERRED = 1
const CHUNK_USAGE_THRESHOLD_CACHED = 42
// 42 * 0.7^11 < 1, aka we keep stale entries around for 11 compiles.
const CHUNK_USAGE_STALE_DECAY_RATE = 0.7

let cacheFlag: RequestCache = 'default'
// Work around a Chrome bug: https://issues.chromium.org/issues/40542704
// Multiple simultaneous requests to same URL with Range header cause failure (block backend returns ERR_CACHE_OPERATION_NOT_SUPPORTED)
const CACHE_NO_STORE = 'no-store'

async function fetchWithBrowserCacheFallback(url: string, init: RequestInit) {
  try {
    return await fetch(url, init)
  } catch (err) {
    if (
      (init.headers as Headers | undefined)?.has('Range') &&
      init.cache !== CACHE_NO_STORE
    ) {
      cacheFlag = CACHE_NO_STORE
      init.cache = CACHE_NO_STORE
      return await fetch(url, init)
    }
    throw err
  }
}

function backfillEdgeBounds(file: PartiallyProcessedPDFFile) {
  const encoder = new TextEncoder()
  for (const chunk of file.ranges) {
    if (chunk.objectId) {
      chunk.objectId = encoder.encode(chunk.objectId as string)
      chunk.start -= chunk.objectId.byteLength
      chunk.size = chunk.end - chunk.start
    }
  }
}

function trimState({
  usageScore,
  cachedUrls,
}: {
  usageScore: Map<string, number>
  cachedUrls: Map<string, { url: string; init: RequestInit }>
}) {
  for (const [hash, score] of usageScore) {
    if (usageScore.size < INCREMENTAL_CACHE_SIZE) {
      break
    }

    if (score >= CHUNK_USAGE_THRESHOLD_TRIGGER_PREFERRED) {
      // Keep entries that are worth caching around for longer.
      usageScore.set(hash, score * CHUNK_USAGE_STALE_DECAY_RATE)
      continue
    }
    cachedUrls.delete(hash)
    usageScore.delete(hash)
  }
}

export function preprocessFileOnce({
  file,
  usageScore,
  cachedUrls,
}: {
  file: PartiallyProcessedPDFFile
  usageScore: Map<string, number>
  cachedUrls: Map<string, { url: string; init: RequestInit }>
}) {
  if ('preprocessed' in file && file.preprocessed) return file
  file.preprocessed = true

  file.createdAt = new Date(file.createdAt || '')
  file.prefetched = file.prefetched || []
  trimState({ usageScore, cachedUrls })
  backfillEdgeBounds(file)
}

function estimateSizeOfMultipartResponse(chunks: Chunk[]) {
  /*
  --boundary
  HEADER
  BLOB
  --boundary
  HEADER
  BLOB
  --boundary--
   */
  return (
    chunks.reduce(
      (totalBytes, chunk) =>
        totalBytes +
        HEADER_OVERHEAD_PER_MULTI_PART_CHUNK +
        (chunk.end - chunk.start),
      0
    ) + ('\r\n' + SAMPLE_NGINX_BOUNDARY + '--').length
  )
}

function trackDownloadStats(
  metrics: PdfCachingMetricsFull,
  {
    size,
    cachedCount,
    cachedBytes,
    fetchedCount,
    fetchedBytes,
  }: {
    size: number
    cachedCount: number
    cachedBytes: number
    fetchedCount: number
    fetchedBytes: number
  }
) {
  metrics.cachedCount += cachedCount
  metrics.cachedBytes += cachedBytes
  metrics.fetchedCount += fetchedCount
  metrics.fetchedBytes += fetchedBytes
  metrics.requestedCount++
  metrics.requestedBytes += size
}

function trackChunkVerify(
  metrics: PdfCachingMetricsFull,
  {
    sizeDiffers,
    mismatch,
    success,
  }: {
    sizeDiffers: boolean
    mismatch: boolean
    success: boolean
  }
) {
  if (sizeDiffers) {
    incrementMetric(metrics, 'chunkVerifySizeDiffers')
  }
  if (mismatch) {
    incrementMetric(metrics, 'chunkVerifyMismatch')
  }
  if (success) {
    incrementMetric(metrics, 'chunkVerifySuccess')
  }
}

function backFillObjectContext(
  chunk: Chunk | Chunk[] | PDFRange<Uint8Array>,
  arrayBuffer: ArrayBuffer
) {
  if (!('objectId' in chunk)) {
    // This is a dynamic chunk
    return new Uint8Array(arrayBuffer)
  }
  const { size, objectId } = chunk
  const fullBuffer = new Uint8Array(size)
  const sourceBuffer = new Uint8Array(arrayBuffer)
  try {
    fullBuffer.set(objectId, 0)
    fullBuffer.set(sourceBuffer, objectId.byteLength)
  } catch (err) {
    throw OError.tag(err, 'broken back-filling of object-id', {
      objectIdByteLength: objectId.byteLength,
      fullBufferByteLength: fullBuffer.byteLength,
      arrayBufferByteLength: arrayBuffer.byteLength,
      sourceBufferByteLength: sourceBuffer.byteLength,
    })
  }
  return fullBuffer
}

function getMatchingChunks<ChunkType extends Chunk>(
  chunks: ChunkType[],
  start: number,
  end: number
) {
  const matchingChunks: ChunkType[] = []
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

function sortBySizeDESC(a: { size: number }, b: { size: number }) {
  return a.size > b.size ? -1 : 1
}

function sortByStartASC(a: { start: number }, b: { start: number }) {
  return a.start > b.start ? 1 : -1
}

function usageAboveThreshold(chunk: PDFRange) {
  // We fetched enough shards of this chunk. Cache it in full now.
  return chunk.totalUsage > CHUNK_USAGE_THRESHOLD_TRIGGER_PREFERRED
}

function cutRequestAmplification({
  potentialChunks,
  usageScore,
  metrics,
  start,
  end,
  prefetchLargeEnabled,
}: {
  potentialChunks: PDFRange[]
  usageScore: Map<string, number>
  metrics: PdfCachingMetricsFull
  start: number
  end: number
  prefetchLargeEnabled: boolean
}) {
  // NOTE: Map keys are stored in insertion order.
  // We re-insert keys on cache hit and turn 'usageScore' into a cheap LRU.

  const chunks: PDFRange[] = []
  const skipAlreadyAdded = (chunk: PDFRange) => !chunks.includes(chunk)
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

function getInterleavingDynamicChunks(
  chunks: Chunk[],
  start: number,
  end: number
) {
  const dynamicChunks: Chunk[] = []
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

function getServerTime(response: Response) {
  const raw = response.headers.get('Date')
  if (!raw) return new Date()
  return new Date(raw)
}

function getResponseSize(response: Response) {
  const raw = response.headers.get('Content-Length')
  if (!raw) return 0
  return parseInt(raw, 10)
}

function getMultipartBoundary(response: Response, chunk: Chunk | Chunk[]) {
  if (!Array.isArray(chunk)) return ''

  const raw = response.headers.get('Content-Type')

  if (raw?.includes('multipart/byteranges')) {
    const idx = raw.indexOf('boundary=')
    if (idx !== -1) return raw.slice(idx + 'boundary='.length)
  }

  throw new OError('missing boundary on multipart request', {
    headers: Object.fromEntries(response.headers.entries()),
    chunk,
  })
}

function composeMultipartHeader({
  boundary,
  start,
  end,
  size,
}: {
  boundary: string
  start: number
  end: number
  size: number
}) {
  return `\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Range: bytes ${start}-${
    end - 1
  }/${size}\r\n\r\n`
}

function incrementMetric(
  metrics: PdfCachingMetricsFull,
  key: keyof PdfCachingMetricsFull
) {
  if (key in metrics) {
    metrics[key]++
  } else {
    ;(metrics[key] as number) = 1
  }
}

function resolveMultiPartResponses({
  file,
  chunks,
  data,
  boundary,
  metrics,
}: {
  file: ProcessedPDFFile
  chunks: Chunk[]
  data: Uint8Array
  boundary: string
  metrics: PdfCachingMetricsFull
}) {
  const responses = []
  let offsetStart = 0
  const encoder = new TextEncoder()
  for (const chunk of chunks) {
    const header = composeMultipartHeader({
      boundary,
      start: chunk.start,
      end: chunk.end,
      size: file.size,
    })
    const headerSize = header.length

    // Verify header content. A proxy might have tampered with it.
    const headerRaw = encoder.encode(header)
    if (
      !data
        .subarray(offsetStart, offsetStart + headerSize)
        .every((v, idx) => v === headerRaw[idx])
    ) {
      incrementMetric(metrics, 'headerVerifyFailure')
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

function checkChunkResponse(
  response: Response,
  estimatedSize: number,
  init: RequestInit
) {
  if (!(response.status === 206 || response.status === 200)) {
    throw new OError('non successful response status: ' + response.status, {
      statusCode: response.status,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      requestHeader: init.headers,
    })
  }
  const responseSize = getResponseSize(response)
  if (!responseSize) {
    throw new OError('content-length response header missing', {
      responseHeaders: Object.fromEntries(response.headers.entries()),
      requestHeader: init.headers,
    })
  }
  if (responseSize > estimatedSize) {
    throw new OError('response size exceeds estimate', {
      estimatedSize,
      responseSize,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      requestHeader: init.headers,
    })
  }
}

function getDynamicChunkInit({
  file,
  start,
  end,
  signal,
}: {
  file: ProcessedPDFFile
  start: number
  end: number
  signal?: AbortSignal | null
}): RequestInit {
  // Avoid making range request when downloading the PDF file in full.
  const isFullFile = start === 0 && end === file.size
  return {
    cache: cacheFlag,
    headers: new Headers(
      isFullFile ? {} : { Range: `bytes=${start}-${end - 1}` }
    ),
    signal,
  }
}

export async function fallbackRequest({
  file,
  url,
  start,
  end,
  abortSignal,
}: {
  file: ProcessedPDFFile
  url: string
  start: number
  end: number
  abortSignal: AbortSignal
}) {
  try {
    const init = getDynamicChunkInit({ file, start, end, signal: abortSignal })
    const response = await fetchWithBrowserCacheFallback(url, init)
    checkChunkResponse(response, end - start, init)
    return await response.arrayBuffer()
  } catch (e) {
    throw OError.tag(e, 'fallback request failed', { url, start, end })
  }
}

async function verifyRange({
  file,
  url,
  start,
  end,
  metrics,
  actual,
  abortSignal,
}: {
  file: ProcessedPDFFile
  url: string
  start: number
  end: number
  metrics: PdfCachingMetricsFull
  actual: Uint8Array
  abortSignal: AbortSignal
}) {
  let expectedRaw
  try {
    expectedRaw = await fallbackRequest({
      file,
      url,
      start,
      end,
      abortSignal,
    })
  } catch (error) {
    throw OError.tag(error, 'cannot verify range', { url, start, end })
  }
  const expected = new Uint8Array(expectedRaw)
  const stats = {
    sizeDiffers: false,
    mismatch: false,
    success: false,
  }
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

function skipPrefetched<ChunkType extends Chunk>(
  chunks: ChunkType[],
  prefetched: PDFRange[],
  start: number,
  end: number
): ChunkType[] {
  return chunks.filter(chunk => {
    return !prefetched.find(
      c =>
        c.start <= Math.max(chunk.start, start) &&
        c.end >= Math.min(chunk.end, end)
    )
  })
}

async function fetchChunk({
  chunk,
  url,
  init,
  cachedUrls,
  metrics,
  cachedUrlLookupEnabled,
  canTryFromCache,
  fallbackToCacheURL,
  file,
}: {
  chunk: Chunk | PDFRange<Uint8Array> | Chunk[]
  url: string
  init: RequestInit
  cachedUrls: Map<string, { url: string; init: RequestInit }>
  metrics: PdfCachingMetricsFull
  cachedUrlLookupEnabled: boolean
  canTryFromCache: (error: any) => boolean
  fallbackToCacheURL: string
  file: ProcessedPDFFile
}) {
  const estimatedSize = Array.isArray(chunk)
    ? estimateSizeOfMultipartResponse(chunk)
    : chunk.end - chunk.start

  if ('hash' in chunk) {
    const oldUrl = cachedUrls.get(chunk.hash)
    if (cachedUrlLookupEnabled && chunk.hash && oldUrl && oldUrl.url !== url) {
      // When the clsi server id changes, the content id changes too and as a
      //  result all the browser cache keys (aka urls) get invalidated.
      // We memorize the previous browser cache keys in `cachedUrls`.
      try {
        oldUrl.init.signal = init.signal
        const response = await fetchWithBrowserCacheFallback(
          oldUrl.url,
          oldUrl.init
        )
        if (response.status === 200) {
          checkChunkResponse(response, estimatedSize, init)
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
      cachedUrls.delete(chunk.hash) // clear cached state
    }
  }

  let response
  try {
    response = await fetchWithBrowserCacheFallback(url, init)
    checkChunkResponse(response, estimatedSize, init)
    if ('hash' in chunk && chunk.hash) {
      delete init.signal // omit the signal from the cache
      cachedUrls.set(chunk.hash, { url, init })
    }
  } catch (err1) {
    if ('hash' in chunk && chunk.hash) {
      cachedUrls.delete(chunk.hash)
    }
    const hasOthersCached = cachedUrls.size > 0
    const info = { url, init, statusCode: response?.status }
    const errTagged = OError.tag(err1, 'add info for canTryFromCache', info)
    if (hasOthersCached && canTryFromCache(errTagged) && fallbackToCacheURL) {
      // Only try downloading chunks that were cached previously
      file.ranges = file.ranges.filter(r => cachedUrls.has(r.hash))
      // Try harder at fetching the chunk, fallback to cache
      url = fallbackToCacheURL
      if ('hash' in chunk && chunk.hash) {
        init = getDynamicChunkInit({
          file,
          // skip object id prefix
          start: chunk.start + chunk.objectId.byteLength,
          end: chunk.end,
          signal: init.signal,
        })
      }
      try {
        response = await fetchWithBrowserCacheFallback(url, init)
        checkChunkResponse(response, estimatedSize, init)
      } catch (err2) {
        throw err1
      }
    } else {
      throw err1
    }
  }
  return response
}

function addPrefetchingChunks({
  file,
  start,
  end,
  dynamicChunks,
  prefetchXRefTable,
  startXRefTableRange,
}: {
  file: ProcessedPDFFile
  start: number
  end: number
  dynamicChunks: Chunk[]
  prefetchXRefTable: boolean
  startXRefTableRange: number
}) {
  // Prefetch in case this is the first range, or we are fetching dynamic
  //  chunks anyway (so we can ride-share the round trip).
  // Rendering cannot start without downloading the xref table, so it's OK to
  //  "delay" the first range.
  if (!(start === 0 || dynamicChunks.length > 0)) {
    return
  }

  let extraChunks: Chunk[] = []
  if (prefetchXRefTable) {
    // Prefetch the dynamic chunks around the xref table.
    extraChunks = skipPrefetched(
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
  extraChunks = extraChunks.concat(
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

  let sum = estimateSizeOfMultipartResponse(dynamicChunks)
  for (const chunk of extraChunks) {
    const downloadSize =
      chunk.end - chunk.start + HEADER_OVERHEAD_PER_MULTI_PART_CHUNK
    if (sum + downloadSize > PDF_JS_CHUNK_SIZE) {
      // In prefetching this chunk we would exceed the bandwidth limit.
      // Try to prefetch another (smaller) chunk.
      continue
    }
    const sibling = dynamicChunks.find(
      sibling => sibling.end === chunk.start || sibling.start === chunk.end
    )
    if (sibling) {
      sum += downloadSize
      // Just expand the existing dynamic chunk.
      sibling.start = Math.min(sibling.start, chunk.start)
      sibling.end = Math.max(sibling.end, chunk.end)
      continue
    }
    if (dynamicChunks.length > MULTI_PART_THRESHOLD) {
      // We are already performing a multipart request. Add another part.
    } else if (dynamicChunks.length < MULTI_PART_THRESHOLD) {
      // We are not yet performing a multipart request. Add another request.
    } else {
      // In prefetching this chunk we would switch to a multipart request.
      // Try to prefetch another (smaller) chunk.
      continue
    }
    sum += downloadSize
    dynamicChunks.push(chunk)
  }
  dynamicChunks.sort(sortByStartASC)

  // Ensure that no chunks are overlapping.
  let lastEnd = 0
  for (const [idx, chunk] of dynamicChunks.entries()) {
    if (chunk.start < lastEnd) {
      throw new OError('detected overlapping dynamic chunks', {
        chunk,
        lastChunk: dynamicChunks[idx - 1],
      })
    }
    lastEnd = chunk.end
  }
}

class Timer {
  max: number
  total: number
  lastStart: number

  constructor() {
    this.max = 0
    this.total = 0
    this.lastStart = 0
  }

  startBlockingCompute() {
    this.lastStart = performance.now()
  }

  finishBlockingCompute() {
    if (this.lastStart === 0) return
    const last = performance.now() - this.lastStart
    if (last > this.max) {
      this.max = last
    }
    this.total += last
    this.lastStart = 0
  }

  reportInto(metrics: PdfCachingMetricsFull) {
    const max = Math.ceil(this.max)
    const total = Math.ceil(this.total)
    if (max > metrics.latencyComputeMax) {
      metrics.latencyComputeMax = max
    }
    metrics.latencyComputeTotal += total
  }
}

export async function fetchRange({
  url,
  start,
  end,
  file,
  queryForChunks,
  metrics,
  usageScore,
  cachedUrls,
  verifyChunks,
  prefetchingEnabled,
  prefetchLargeEnabled,
  cachedUrlLookupEnabled,
  abortSignal,
  canTryFromCache,
  fallbackToCacheURL,
}: {
  url: string
  start: number
  end: number
  file: ProcessedPDFFile
  queryForChunks: string
  metrics: PdfCachingMetricsFull
  usageScore: Map<string, number>
  cachedUrls: Map<string, { url: string; init: RequestInit }>
  verifyChunks: boolean
  prefetchingEnabled: boolean
  prefetchLargeEnabled: boolean
  cachedUrlLookupEnabled: boolean
  abortSignal: AbortSignal
  canTryFromCache: (error: any) => boolean
  fallbackToCacheURL: string
}) {
  const timer = new Timer()
  timer.startBlockingCompute()

  const startXRefTableRange =
    file.startXRefTable !== undefined
      ? Math.floor(file.startXRefTable / PDF_JS_CHUNK_SIZE) * PDF_JS_CHUNK_SIZE
      : 0

  const prefetchXRefTable =
    prefetchingEnabled && startXRefTableRange > 0 && start === 0
  const prefetched = getMatchingChunks(file.prefetched, start, end)

  // Check that handling the range request won't trigger excessive sub-requests,
  // (to avoid unwanted latency compared to the original request).
  const chunks: PDFRange[] = cutRequestAmplification({
    potentialChunks: skipPrefetched(
      getMatchingChunks(file.ranges, start, end),
      prefetched,
      start,
      end
    ),
    usageScore,
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
    timer.finishBlockingCompute()
    timer.reportInto(metrics)
    trackDownloadStats(metrics, {
      size,
      cachedCount: 0,
      cachedBytes: 0,
      fetchedCount: 1,
      fetchedBytes: size,
    })
    return fallbackRequest({ file, url, start, end, abortSignal })
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

  const coalescedDynamicChunks: {
    chunk: Chunk | Chunk[]
    url: string
    init: RequestInit
  }[] = []

  switch (true) {
    case dynamicChunks.length === 0:
      break
    case dynamicChunks.length === 1:
      coalescedDynamicChunks.push({
        chunk: dynamicChunks[0],
        url,
        init: {
          cache: cacheFlag,
          headers: new Headers({ Range: `bytes=${byteRanges}` }),
        },
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
          init: {
            cache: cacheFlag,
            headers: new Headers({
              Range: `bytes=${chunk.start}-${chunk.end - 1}`,
            }),
          },
        })
      })
      break
    default:
      coalescedDynamicChunks.push({
        chunk: dynamicChunks,
        url,
        init: {
          cache: cacheFlag,
          headers: new Headers({ Range: `bytes=${byteRanges}` }),
        },
      })
  }

  // The schema of `url` is https://domain/project/:id/user/:id/build/... for
  //  authenticated and https://domain/project/:id/build/... for
  //  unauthenticated users. Cut it before /build/.
  // The path may have an optional /zone/b prefix too.
  const perUserPrefix = url.slice(0, url.indexOf('/build/'))
  const requests = chunks
    .map(chunk => ({
      chunk: chunk as Chunk | Chunk[],
      url: `${perUserPrefix}/content/${file.contentId}/${chunk.hash}?${queryForChunks}`,
      init: {},
    }))
    .concat(coalescedDynamicChunks) as {
    chunk: PDFRange | Chunk | Chunk[]
    url: string
    init: RequestInit
  }[]

  let cachedCount = 0
  let cachedBytes = 0
  let fetchedCount = 0
  let fetchedBytes = 0
  const reassembledBlob = new Uint8Array(size)

  // Pause while performing network IO
  timer.finishBlockingCompute()

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
          canTryFromCache,
          fallbackToCacheURL,
          file,
        })
        timer.startBlockingCompute()
        const boundary = getMultipartBoundary(response, chunk)
        const blobFetchDate = getServerTime(response)
        const blobSize = getResponseSize(response)
        if (blobFetchDate && blobSize) {
          // Example: 2MB PDF, 1MB image, 128KB PDF.js chunk.
          //     | pdf.js chunk |
          //   | A BIG IMAGE BLOB |
          // |     THE     FULL     PDF     |
          if ('hash' in chunk && chunk.hash && blobFetchDate < file.createdAt) {
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
        timer.finishBlockingCompute()
        const buf = await response.arrayBuffer()
        timer.startBlockingCompute()
        const data = backFillObjectContext(chunk, buf)
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
      } finally {
        timer.finishBlockingCompute()
      }
    })
  )

  timer.startBlockingCompute()

  rawResponses
    .flat() // flatten after splitting multipart responses
    .concat(prefetched.map(chunk => ({ chunk, data: chunk.buffer })))
    .forEach(
      ({
        chunk,
        data,
      }: {
        chunk: Chunk | PrefetchedChunk<Chunk | PDFRange<Uint8Array>>
        data: Uint8Array
      }) => {
        if ('hash' in chunk && chunk.end > end) {
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
        const oldDataLength = data.length
        if (offsetStart > 0 || offsetEnd > 0) {
          // compute index positions for slice to handle case where offsetEnd=0
          const chunkSize = chunk.end - chunk.start
          data = data.subarray(offsetStart, chunkSize - offsetEnd)
        }
        const newDataLength = data.length
        const insertPosition = Math.max(chunk.start - start, 0)

        try {
          reassembledBlob.set(data, insertPosition)
        } catch (err) {
          const reassembledBlobLength = reassembledBlob.length

          const trimmedChunk = {
            start: chunk.start,
            end: chunk.end,
            hash: 'hash' in chunk ? chunk.hash : undefined,
            objectId:
              'objectId' in chunk
                ? new TextDecoder().decode(chunk.objectId)
                : undefined,
          }
          throw OError.tag(err, 'broken reassembly', {
            start,
            end,
            chunk: trimmedChunk,
            oldDataLength,
            newDataLength,
            offsetStart,
            offsetEnd,
            insertPosition,
            reassembledBlobLength,
          })
        }
      }
    )

  timer.finishBlockingCompute()
  timer.reportInto(metrics)
  trackDownloadStats(metrics, {
    size,
    cachedCount,
    cachedBytes,
    fetchedCount,
    fetchedBytes,
  })

  if (verifyChunks) {
    return await verifyRange({
      file,
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
