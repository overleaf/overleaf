import { fallbackRequest, fetchRange } from './pdf-caching'
import { captureException } from '../../../infrastructure/error-reporter'
import { getPdfCachingMetrics } from './metrics'
import { enablePdfCaching, trackPdfDownloadEnabled } from './pdf-caching-flags'

export function generatePdfCachingTransportFactory(PDFJS) {
  // NOTE: The custom transport can be used for tracking download volume.
  if (!enablePdfCaching && !trackPdfDownloadEnabled) {
    return () => null
  }
  let failedOnce = false
  const cached = new Set()
  const metrics = Object.assign(getPdfCachingMetrics(), {
    failedCount: 0,
    tooLargeOverheadCount: 0,
    tooManyRequestsCount: 0,
    cachedCount: 0,
    cachedBytes: 0,
    fetchedCount: 0,
    fetchedBytes: 0,
    requestedCount: 0,
    requestedBytes: 0,
    enablePdfCaching,
  })
  const verifyChunks =
    new URLSearchParams(window.location.search).get('verify_chunks') === 'true'

  class PDFDataRangeTransport extends PDFJS.PDFDataRangeTransport {
    constructor(url, pdfFile, reject) {
      super(pdfFile.size, new Uint8Array())
      this.url = url
      this.pdfFile = pdfFile
      this.reject = reject
      this.abortController = new AbortController()
    }

    abort() {
      this.abortController.abort()
    }

    requestDataRange(start, end) {
      const abortSignal = this.abortController.signal
      fetchRange({
        url: this.url,
        start,
        end,
        file: this.pdfFile,
        metrics,
        cached,
        verifyChunks,
        abortSignal,
      })
        .catch(err => {
          metrics.failedCount++
          failedOnce = true
          if (!enablePdfCaching) {
            throw err // This was a fallback request already. Do not retry.
          }
          console.error('optimized pdf download error', err)
          captureException(err)
          return fallbackRequest({ url: this.url, start, end, abortSignal })
        })
        .then(blob => {
          this.onDataRange(start, blob)
        })
        .catch(err => {
          console.error('fatal pdf download error', err)
          captureException(err)
          this.reject(err)
        })
    }
  }

  return function (url, pdfFile, reject) {
    if (failedOnce) {
      // Disable pdf caching once any fetch request failed.
      // Be trigger-happy here until we reached a stable state of the feature.
      return null
    }
    return new PDFDataRangeTransport(url, pdfFile, reject)
  }
}
