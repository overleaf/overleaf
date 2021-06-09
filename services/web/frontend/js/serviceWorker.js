import { v4 as uuid } from 'uuid'
const OError = require('@overleaf/o-error')

const COMPILE_REQUEST_MATCHER = /^\/project\/[0-9a-f]{24}\/compile$/
const PDF_REQUEST_MATCHER = /^\/project\/[0-9a-f]{24}\/.*\/output.pdf$/
const PDF_JS_CHUNK_SIZE = 128 * 1024
const MAX_SUBREQUEST_COUNT = 8
const MAX_SUBREQUEST_BYTES = 4 * PDF_JS_CHUNK_SIZE

// Each compile request defines a context (essentially the specific pdf file for
// that compile), requests for that pdf file can use the hashes in the compile
// response, which are stored in the context.

const CLIENT_CONTEXT = new Map()

/**
 * @param {string} clientId
 */
function getClientContext(clientId) {
  let clientContext = CLIENT_CONTEXT.get(clientId)
  if (!clientContext) {
    const pdfs = new Map()
    const metrics = {
      id: uuid(),
      epoch: Date.now(),
      cachedBytes: 0,
      fetchedBytes: 0,
      requestedBytes: 0,
    }
    clientContext = { pdfs, metrics }
    CLIENT_CONTEXT.set(clientId, clientContext)
    // clean up old client maps
    expirePdfContexts()
  }
  return clientContext
}

/**
 * @param {string} clientId
 * @param {string} path
 * @param {Object} pdfContext
 */
function registerPdfContext(clientId, path, pdfContext) {
  const clientContext = getClientContext(clientId)
  const { pdfs, metrics } = clientContext
  pdfContext.metrics = metrics
  // we only need to keep the last 3 contexts
  for (const key of pdfs.keys()) {
    if (pdfs.size < 3) {
      break
    }
    pdfs.delete(key) // the map keys are returned in insertion order, so we are deleting the oldest entry here
  }
  pdfs.set(path, pdfContext)
}

/**
 * @param {string} clientId
 * @param {string} path
 */
function getPdfContext(clientId, path) {
  const { pdfs } = getClientContext(clientId)
  return pdfs.get(path)
}

function expirePdfContexts() {
  // discard client maps for clients that are no longer connected
  const currentClientSet = new Set()
  self.clients.matchAll().then(function (clientList) {
    clientList.forEach(client => {
      currentClientSet.add(client.id)
    })
    CLIENT_CONTEXT.forEach((map, clientId) => {
      if (!currentClientSet.has(clientId)) {
        CLIENT_CONTEXT.delete(clientId)
      }
    })
  })
}

/**
 *
 * @param {Object} metrics
 * @param {number} size
 * @param {number} cachedBytes
 * @param {number} fetchedBytes
 */
function trackDownloadStats(metrics, { size, cachedBytes, fetchedBytes }) {
  metrics.cachedBytes += cachedBytes
  metrics.fetchedBytes += fetchedBytes
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

  if (path.match(PDF_REQUEST_MATCHER)) {
    const ctx = getPdfContext(event.clientId, path)
    if (ctx) {
      return processPdfRequest(event, ctx)
    }
  }

  // other request, ignore
}

/**
 * @param {FetchEvent} event
 */
function processCompileRequest(event) {
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.status !== 200) return response

      return response.json().then(body => {
        handleCompileResponse(event, response, body)

        // Send the service workers metrics to the frontend.
        const { metrics } = getClientContext(event.clientId)
        body.serviceWorkerMetrics = metrics

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
 * @param {Object} metrics
 */
function processPdfRequest(
  event,
  { file, clsiServerId, compileGroup, pdfCreatedAt, metrics }
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
              throw new OError(
                'non successful response status: ' + response.status
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
          .catch(error => {
            throw OError.tag(error, 'cannot fetch chunk', { url })
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
              const stats = {}
              if (reAssembledBlob.byteLength !== fullBlob.byteLength) {
                stats.sizeDiffers = true
              } else if (
                !reAssembledBlob.every((v, idx) => v === fullBlob[idx])
              ) {
                stats.mismatch = true
              } else {
                stats.success = true
              }
              trackChunkVerify(metrics, stats)
              if (stats.success === true) {
                return reAssembledBlob
              } else {
                return fullBlob
              }
            })
        }

        return verifyProcess.then(blob => {
          trackDownloadStats(metrics, { size, cachedBytes, fetchedBytes })
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
        reportError(event, OError.tag(error, 'failed to compose pdf response'))
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
 * @param {FetchEvent} event
 * @param {Response} response
 * @param {Object} body
 */
function handleCompileResponse(event, response, body) {
  if (!body || body.status !== 'success') return

  const pdfCreatedAt = getServerTime(response)

  for (const file of body.outputFiles) {
    if (file.path !== 'output.pdf') continue // not the pdf used for rendering
    if (file.ranges) {
      file.ranges.forEach(backFillEdgeBounds)
      const { clsiServerId, compileGroup } = body
      registerPdfContext(event.clientId, file.url, {
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

/**
 * @param {FetchEvent} event
 */
function onFetchWithErrorHandling(event) {
  try {
    onFetch(event)
  } catch (error) {
    reportError(event, OError.tag(error, 'low level error in onFetch'))
  }
}

// listen to all network requests
self.addEventListener('fetch', onFetchWithErrorHandling)

// complete setup ASAP
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

/**
 *
 * @param {FetchEvent} event
 * @param {Error} error
 */
function reportError(event, error) {
  self.clients
    .get(event.clientId)
    .then(client => {
      if (!client) {
        // The client disconnected.
        return
      }
      client.postMessage(
        JSON.stringify({
          extra: { url: event.request.url, info: OError.getFullInfo(error) },
          error: {
            name: error.name,
            message: error.message,
            stack: OError.getFullStack(error),
          },
        })
      )
    })
    .catch(() => {})
}
