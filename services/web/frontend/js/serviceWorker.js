const COMPILE_REQUEST_MATCHER = /^\/project\/[0-9a-f]{24}\/compile$/
const MIN_CHUNK_SIZE = 128 * 1024

const PDF_FILES = new Map()

const METRICS = {
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
  if (!event.request.headers.has('Range') && file.size > MIN_CHUNK_SIZE) {
    // skip probe request
    const headers = new Headers()
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Content-Length', file.size)
    headers.set('Content-Type', 'application/pdf')
    return event.respondWith(
      new Response('', {
        headers,
        status: 200,
        statusText: 'OK',
      })
    )
  }

  const rangeHeader =
    event.request.headers.get('Range') || `bytes=0-${file.size}`
  const [start, last] = rangeHeader
    .slice('bytes='.length)
    .split('-')
    .map(i => parseInt(i, 10))
  const end = last + 1

  const chunks = getMatchingChunks(file.ranges, start, end)

  const dynamicChunks = getInterleavingDynamicChunks(chunks, start, end)

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
            return { chunk, arrayBuffer }
          })
      )
    )
      .then(responses => {
        responses.forEach(({ chunk, arrayBuffer }) => {
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
            arrayBuffer = arrayBuffer.slice(offsetStart, chunkSize - offsetEnd)
          }
          const insertPosition = Math.max(chunk.start - start, 0)
          reAssembledBlob.set(new Uint8Array(arrayBuffer), insertPosition)
        })

        trackStats({ size, cachedBytes, fetchedBytes })
        return new Response(reAssembledBlob, {
          status: 206,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': size,
            'Content-Range': `bytes ${start}-${last}/${file.size}`,
            'Content-Type': 'application/pdf',
          },
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
