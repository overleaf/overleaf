import { v4 as uuid } from 'uuid'
import { fetchRange } from './features/pdf-preview/util/pdf-caching'
const OError = require('@overleaf/o-error')

// VERSION should get incremented when making changes to caching behavior or
//  adjusting metrics collection.
// Keep in sync with PdfJsMetrics.
const VERSION = 3

const CLEAR_CACHE_REQUEST_MATCHER = /^\/project\/[0-9a-f]{24}\/output$/
const COMPILE_REQUEST_MATCHER = /^\/project\/[0-9a-f]{24}\/compile$/
const PDF_REQUEST_MATCHER =
  /^(\/zone\/.)?(\/project\/[0-9a-f]{24}\/.*\/output.pdf)$/
const PDF_JS_CHUNK_SIZE = 128 * 1024

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
    const cached = new Set()
    const pdfs = new Map()
    const metrics = {
      version: VERSION,
      id: uuid(),
      epoch: Date.now(),
      failedCount: 0,
      tooLargeOverheadCount: 0,
      tooManyRequestsCount: 0,
      cachedCount: 0,
      cachedBytes: 0,
      fetchedCount: 0,
      fetchedBytes: 0,
      requestedCount: 0,
      requestedBytes: 0,
      compileCount: 0,
    }
    clientContext = { pdfs, metrics, cached }
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
  const { pdfs, metrics, cached, clsiServerId } = clientContext
  pdfContext.metrics = metrics
  pdfContext.cached = cached
  if (pdfContext.clsiServerId !== clsiServerId) {
    // VM changed, this invalidates all browser caches.
    clientContext.clsiServerId = pdfContext.clsiServerId
    cached.clear()
  }
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
 * @param {FetchEvent} event
 */
function onFetch(event) {
  const url = new URL(event.request.url)
  const path = url.pathname

  if (path.match(COMPILE_REQUEST_MATCHER)) {
    return processCompileRequest(event)
  }

  const match = path.match(PDF_REQUEST_MATCHER)
  if (match) {
    const ctx = getPdfContext(event.clientId, match[2])
    if (ctx) {
      return processPdfRequest(event, ctx)
    }
  }

  if (
    event.request.method === 'DELETE' &&
    path.match(CLEAR_CACHE_REQUEST_MATCHER)
  ) {
    return processClearCacheRequest(event)
  }

  // other request, ignore
}

/**
 * @param {FetchEvent} event
 */
function processClearCacheRequest(event) {
  CLIENT_CONTEXT.delete(event.clientId)
  // use default request proxy.
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
        metrics.compileCount++
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
 * @param {Set} cached
 */
function processPdfRequest(
  event,
  { file, clsiServerId, compileGroup, pdfCreatedAt, metrics, cached }
) {
  const response = handleProbeRequest(event.request, file)
  if (response) {
    return event.respondWith(response)
  }

  const rangeHeader =
    event.request.headers.get('Range') || `bytes=0-${file.size - 1}`
  const [start, last] = rangeHeader
    .slice('bytes='.length)
    .split('-')
    .map(i => parseInt(i, 10))
  const end = last + 1

  return event.respondWith(
    fetchRange({
      url: event.request.url,
      start,
      end,
      file,
      pdfCreatedAt,
      metrics,
      cached,
    })
      .then(blob => {
        return new Response(blob, {
          status: 206,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start,
            'Content-Range': `bytes ${start}-${last}/${file.size}`,
            'Content-Type': 'application/pdf',
          },
        })
      })
      .catch(error => {
        metrics.failedCount++
        reportError(event, OError.tag(error, 'failed to compose pdf response'))
        return fetch(event.request)
      })
  )
}

/**
 * @param {FetchEvent} event
 * @param {Response} response
 * @param {Object} body
 */
function handleCompileResponse(event, response, body) {
  if (!body || body.status !== 'success') return

  for (const file of body.outputFiles) {
    if (file.path !== 'output.pdf') continue // not the pdf used for rendering
    if (file.ranges?.length) {
      const { clsiServerId, compileGroup } = body
      registerPdfContext(event.clientId, file.url, {
        file,
        clsiServerId,
        compileGroup,
      })
    }
    break
  }
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
// allow fetch event listener to be removed if necessary
const controller = new AbortController()
// listen to all network requests
self.addEventListener('fetch', onFetchWithErrorHandling, {
  signal: controller.signal,
})

// complete setup ASAP
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'disable') {
    controller.abort() // removes the fetch event listener
  }
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
