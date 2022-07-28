import OError from '@overleaf/o-error'
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
      const errorInfo = {
        pdfFile: this.pdfFile,
        pdfUrl: this.url,
        start,
        end,
        metrics,
      }
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
          if (
            err.message === 'non successful response status: 404' &&
            OError.getFullInfo(err).url === this.url
          ) {
            // Do not consider a 404 on the main pdf url as pdf caching failure.
            // Still, bail out during the initial launch phase.
            failedOnce = true
            throw new PDFJS.MissingPDFException()
          }
          metrics.failedCount++
          failedOnce = true
          if (!enablePdfCaching) {
            throw err // This was a fallback request already. Do not retry.
          }
          err = OError.tag(err, 'optimized pdf download error', errorInfo)
          console.error(err)
          captureException(err, { tags: { fromPdfCaching: true } })
          return fallbackRequest({ url: this.url, start, end, abortSignal })
        })
        .then(blob => {
          this.onDataRange(start, blob)
        })
        .catch(err => {
          err = OError.tag(err, 'fatal pdf download error', errorInfo)
          console.error(err)
          if (!(err instanceof PDFJS.MissingPDFException)) {
            captureException(err, { tags: { fromPdfCaching: true } })
          }
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
