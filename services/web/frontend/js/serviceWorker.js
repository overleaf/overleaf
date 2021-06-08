import { v4 as uuid } from 'uuid'
const COMPILE_REQUEST_MATCHER = /^\/project\/[0-9a-f]{24}\/compile$/
const PDF_JS_CHUNK_SIZE = 128 * 1024
const MAX_SUBREQUEST_COUNT = 8
const MAX_SUBREQUEST_BYTES = 4 * PDF_JS_CHUNK_SIZE
const PDF_FILES = new Map()

const METRICS = {
  id: uuid(),
  epoch: Date.now(),
  cachedBytes: 0,
  fetchedBytes: 0,
  requestedBytes: 0,
}

/**
 *
 * @param {number} size
 * @param {number} cachedBytes
 * @param {number} fetchedBytes
 */
function trackStats({ size, cachedBytes, fetchedBytes }) {
  METRICS.cachedBytes += cachedBytes
  METRICS.fetchedBytes += fetchedBytes
  METRICS.requestedBytes += size
}

/**
 * @param {boolean} sizeDiffers
 * @param {boolean} mismatch
 * @param {boolean} success
 */
function trackChunkVerify({ sizeDiffers, mismatch, success }) {
  if (sizeDiffers) {
    METRICS.chunkVerifySizeDiffers |= 0
    METRICS.chunkVerifySizeDiffers += 1
  }
  if (mismatch) {
    METRICS.chunkVerifyMismatch |= 0
    METRICS.chunkVerifyMismatch += 1
  }
  if (success) {
    METRICS.chunkVerifySuccess |= 0
    METRICS.chunkVerifySuccess += 1
  }
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
 * @param {FetchEvent} event
 */
function onFetch(event) {
  const url = new URL(event.request.url)
  const path = url.pathname

  if (path.match(COMPILE_REQUEST_MATCHER)) {
    return processCompileRequest(event)
  }

  const ctx = PDF_FILES.get(path)
  if (ctx) {
    return processPdfRequest(event, ctx)
  }

  // other request, ignore
}

function processCompileRequest(event) {
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.status !== 200) return response

      return response.json().then(body => {
        handleCompileResponse(response, body)
        // Send the service workers metrics to the frontend.
        body.serviceWorkerMetrics = METRICS
        return new Response(JSON.stringify(body), response)
      })
    })
  )
}

/**
 * @param {Request} request
 * @param {Object} file
 * @return {Response}
 */
function handleProbeRequest(request, file) {
  // PDF.js starts the pdf download with a probe request that has no
  //  range headers on it.
  // Upon seeing the response headers, it decides whether to upgrade the
  //  transport to chunked requests or keep reading the response body.
  // For small PDFs (2*chunkSize = 2*128kB) it just sends one request.
  //  We will fetch all the ranges in bulk and emit them.
  // For large PDFs it sends this probe request, aborts that request before
  //  reading any data and then sends multiple range requests.
  // It would be wasteful to action this probe request with all the ranges
  //  that are available in the PDF and serve the full PDF content to
  //  PDF.js for the probe request.
  // We are emitting a dummy response to the probe request instead.
  // It triggers the chunked transfer and subsequent fewer ranges need to be
  //  requested -- only those of visible pages in the pdf viewer.
  // https://github.com/mozilla/pdf.js/blob/6fd899dc443425747098935207096328e7b55eb2/src/display/network_utils.js#L43-L47
  const pdfJSWillUseChunkedTransfer = file.size > 2 * PDF_JS_CHUNK_SIZE
  const isRangeRequest = request.headers.has('Range')
  if (!isRangeRequest && pdfJSWillUseChunkedTransfer) {
    const headers = new Headers()
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Content-Length', file.size)
    headers.set('Content-Type', 'application/pdf')
    return new Response('', {
      headers,
      status: 200,
      statusText: 'OK',
    })
  }
}

/**
 *
 * @param {FetchEvent} event
 * @param {Object} file
 * @param {string} clsiServerId
 * @param {string} compileGroup
 * @param {Date} pdfCreatedAt
 */
function processPdfRequest(
  event,
  { file, clsiServerId, compileGroup, pdfCreatedAt }
) {
  const response = handleProbeRequest(event.request, file)
  if (response) {
    return event.respondWith(response)
  }

  const verifyChunks = event.request.url.includes('verify_chunks=true')
  const rangeHeader =
    event.request.headers.get('Range') || `bytes=0-${file.size - 1}`
  const [start, last] = rangeHeader
    .slice('bytes='.length)
    .split('-')
    .map(i => parseInt(i, 10))
  const end = last + 1

  // Check that handling the range request won't trigger excessive subrequests,
  // (to avoid unwanted latency compared to the original request).
  const chunks = getMatchingChunks(file.ranges, start, end)
  const dynamicChunks = getInterleavingDynamicChunks(chunks, start, end)
  const chunksSize = countBytes(chunks)

  if (chunks.length + dynamicChunks.length > MAX_SUBREQUEST_COUNT) {
    // fall back to the original range request when splitting the range creates
    // too many subrequests.
    return
  }
  if (
    chunksSize > MAX_SUBREQUEST_BYTES &&
    !(dynamicChunks.length === 0 && chunks.length === 1)
  ) {
    // fall back to the original range request when a very large amount of
    // object data would be requested, unless it is the only object in the
    // request.
    return
  }

  // URL prefix is /project/:id/user/:id/build/... or /project/:id/build/...
  //  for authenticated and unauthenticated users respectively.
  const perUserPrefix = file.url.slice(0, file.url.indexOf('/build/'))
  const requests = chunks
    .map(chunk => {
      const path = `${perUserPrefix}/content/${file.contentId}/${chunk.hash}`
      const url = new URL(path, event.request.url)
      if (clsiServerId) {
        url.searchParams.set('clsiserverid', clsiServerId)
      }
      if (compileGroup) {
        url.searchParams.set('compileGroup', compileGroup)
      }
      return { chunk, url: url.toString() }
    })
    .concat(
      dynamicChunks.map(chunk => {
        const { start, end } = chunk
        return {
          chunk,
          url: event.request.url,
          init: { headers: { Range: `bytes=${start}-${end - 1}` } },
        }
      })
    )
  const size = end - start
  let cachedBytes = 0
  let fetchedBytes = 0
  const reAssembledBlob = new Uint8Array(size)
  event.respondWith(
    Promise.all(
      requests.map(({ chunk, url, init }) =>
        fetch(url, init)
          .then(response => {
            if (!(response.status === 206 || response.status === 200)) {
              throw new Error(
                `could not fetch ${url} ${JSON.stringify(init)}: ${
                  response.status
                }`
              )
            }
            const blobFetchDate = getServerTime(response)
            const blobSize = getResponseSize(response)
            if (blobFetchDate && blobSize) {
              const chunkSize =
                Math.min(end, chunk.end) - Math.max(start, chunk.start)
              // Example: 2MB PDF, 1MB image, 128KB PDF.js chunk.
              //     | pdf.js chunk |
              //   | A BIG IMAGE BLOB |
              // |     THE     FULL     PDF     |
              if (blobFetchDate < pdfCreatedAt) {
                cachedBytes += chunkSize
              } else {
                // Blobs are fetched in bulk.
                fetchedBytes += blobSize
              }
            }
            return response.arrayBuffer()
          })
          .then(arrayBuffer => {
            return {
              chunk,
              data: backFillObjectContext(chunk, arrayBuffer),
            }
          })
      )
    )
      .then(responses => {
        responses.forEach(({ chunk, data }) => {
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
            data = data.slice(offsetStart, chunkSize - offsetEnd)
          }
          const insertPosition = Math.max(chunk.start - start, 0)
          reAssembledBlob.set(data, insertPosition)
        })

        let verifyProcess = Promise.resolve(reAssembledBlob)
        if (verifyChunks) {
          verifyProcess = fetch(event.request)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => {
              const fullBlob = new Uint8Array(arrayBuffer)
              const metrics = {}
              if (reAssembledBlob.byteLength !== fullBlob.byteLength) {
                metrics.sizeDiffers = true
              } else if (
                !reAssembledBlob.every((v, idx) => v === fullBlob[idx])
              ) {
                metrics.mismatch = true
              } else {
                metrics.success = true
              }
              trackChunkVerify(metrics)
              if (metrics.success === true) {
                return reAssembledBlob
              } else {
                return fullBlob
              }
            })
        }

        return verifyProcess.then(blob => {
          trackStats({ size, cachedBytes, fetchedBytes })
          return new Response(blob, {
            status: 206,
            headers: {
              'Accept-Ranges': 'bytes',
              'Content-Length': size,
              'Content-Range': `bytes ${start}-${last}/${file.size}`,
              'Content-Type': 'application/pdf',
            },
          })
        })
      })
      .catch(error => {
        console.error('Could not fetch partial pdf chunks', error)
        return fetch(event.request)
      })
  )
}

/**
 *
 * @param {Response} response
 */
function getServerTime(response) {
  const raw = response.headers.get('Date')
  if (!raw) return undefined
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
 * @param {Response} response
 * @param {Object} body
 */
function handleCompileResponse(response, body) {
  if (!body || body.status !== 'success') return

  const pdfCreatedAt = getServerTime(response)

  for (const file of body.outputFiles) {
    if (file.path !== 'output.pdf') continue // not the pdf used for rendering
    if (file.ranges) {
      file.ranges.forEach(backFillEdgeBounds)
      const { clsiServerId, compileGroup } = body
      PDF_FILES.set(file.url, {
        pdfCreatedAt,
        file,
        clsiServerId,
        compileGroup,
      })
    }
    break
  }
}

const ENCODER = new TextEncoder()
function backFillEdgeBounds(chunk) {
  if (chunk.objectId) {
    chunk.objectId = ENCODER.encode(chunk.objectId)
    chunk.start -= chunk.objectId.byteLength
  }
  return chunk
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

// listen to all network requests
self.addEventListener('fetch', onFetch)

// complete setup ASAP
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
