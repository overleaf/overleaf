import OError from '@overleaf/o-error'
import { fallbackRequest, fetchRange } from './pdf-caching'
import { captureException } from '../../../infrastructure/error-reporter'
import { getPdfCachingMetrics } from './metrics'
import {
  cachedUrlLookupEnabled,
  enablePdfCaching,
  prefetchingEnabled,
  prefetchLargeEnabled,
  trackPdfDownloadEnabled,
} from './pdf-caching-flags'

// 30 seconds: The shutdown grace period of a clsi pre-emp instance.
const STALE_OUTPUT_REQUEST_THRESHOLD_MS = 30 * 1000

export function generatePdfCachingTransportFactory(PDFJS) {
  // NOTE: The custom transport can be used for tracking download volume.
  if (!enablePdfCaching && !trackPdfDownloadEnabled) {
    return () => null
  }
  const usageScore = new Map()
  const cachedUrls = new Map()
  const metrics = Object.assign(getPdfCachingMetrics(), {
    failedCount: 0,
    failedOnce: false,
    tooMuchBandwidthCount: 0,
    tooManyRequestsCount: 0,
    cachedCount: 0,
    cachedBytes: 0,
    fetchedCount: 0,
    fetchedBytes: 0,
    latencyComputeMax: 0,
    latencyComputeTotal: 0,
    requestedCount: 0,
    requestedBytes: 0,
    oldUrlHitCount: 0,
    oldUrlMissCount: 0,
    enablePdfCaching,
    prefetchingEnabled,
    prefetchLargeEnabled,
    cachedUrlLookupEnabled,
  })
  const verifyChunks =
    new URLSearchParams(window.location.search).get('verify_chunks') === 'true'

  class PDFDataRangeTransport extends PDFJS.PDFDataRangeTransport {
    constructor({ url, pdfFile, abortController, handleFetchError }) {
      super(pdfFile.size, new Uint8Array())
      this.url = url
      this.pdfFile = pdfFile
      // Clone the chunks as the objectId field is encoded to a Uint8Array.
      this.pdfRanges = pdfFile.ranges.map(r => Object.assign({}, r))
      this.handleFetchError = handleFetchError
      this.abortController = abortController
      this.startTime = performance.now()
    }

    abort() {
      this.abortController.abort()
    }

    requestDataRange(start, end) {
      const abortSignal = this.abortController.signal
      const getDebugInfo = () => ({
        // Sentry does not serialize objects in twice nested objects.
        // Move the ranges to the root level to see them in Sentry.
        pdfRanges: this.pdfRanges,
        pdfFile: Object.assign({}, this.pdfFile, {
          ranges: '[extracted]',
          // Hide prefetched chunks as these include binary blobs.
          prefetched: this.pdfFile.prefetched?.length,
        }),
        pdfUrl: this.url,
        start,
        end,
        metrics,
      })

      const isStaleOutputRequest = () =>
        performance.now() - this.startTime > STALE_OUTPUT_REQUEST_THRESHOLD_MS
      const is404 = err => err.message === 'non successful response status: 404'
      const isNetworkError = err => err.message === 'Failed to fetch'
      const isFromOutputPDFRequest = err =>
        OError.getFullInfo(err).url === this.url

      // Do not consider "expected 404s" and network errors as pdf caching
      //  failures.
      // "expected 404s" here include:
      // - any stale download request
      //   Example: The user returns to a browser tab after 1h and scrolls.
      // - requests for the main output.pdf file
      //   A fallback request would not be able to retrieve the PDF either.
      const isExpectedError = err =>
        (is404(err) || isNetworkError(err)) &&
        (isStaleOutputRequest() || isFromOutputPDFRequest(err))

      fetchRange({
        url: this.url,
        start,
        end,
        file: this.pdfFile,
        metrics,
        usageScore,
        cachedUrls,
        verifyChunks,
        prefetchingEnabled,
        prefetchLargeEnabled,
        cachedUrlLookupEnabled,
        abortSignal,
      })
        .catch(err => {
          if (abortSignal.aborted) return
          if (isExpectedError(err)) {
            throw new PDFJS.MissingPDFException()
          }
          metrics.failedCount++
          metrics.failedOnce = true
          if (!enablePdfCaching) {
            throw err // This was a fallback request already. Do not retry.
          }
          err = OError.tag(err, 'optimized pdf download error', getDebugInfo())
          console.error(err)
          captureException(err, { tags: { fromPdfCaching: true } })
          return fallbackRequest({
            url: this.url,
            start,
            end,
            abortSignal,
          }).catch(err => {
            if (isExpectedError(err)) {
              err = new PDFJS.MissingPDFException()
            }
            throw err
          })
        })
        .then(blob => {
          if (abortSignal.aborted) return
          this.onDataRange(start, blob)
        })
        .catch(err => {
          if (abortSignal.aborted) return
          err = OError.tag(err, 'fatal pdf download error', getDebugInfo())
          console.error(err)
          if (!(err instanceof PDFJS.MissingPDFException)) {
            captureException(err, { tags: { fromPdfCaching: true } })
          }
          // Signal error for (subsequent) page load.
          this.handleFetchError(err)
        })
    }
  }

  return function ({ url, pdfFile, abortController, handleFetchError }) {
    if (metrics.failedOnce) {
      // Disable pdf caching once any fetch request failed.
      // Be trigger-happy here until we reached a stable state of the feature.
      return null
    }
    // Latency is collected per preview cycle.
    metrics.latencyComputeMax = 0
    metrics.latencyComputeTotal = 0
    return new PDFDataRangeTransport({
      url,
      pdfFile,
      abortController,
      handleFetchError,
    })
  }
}
