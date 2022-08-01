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
      this.handleFetchError = handleFetchError
      this.abortController = abortController
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
          if (
            err.message === 'non successful response status: 404' &&
            OError.getFullInfo(err).url === this.url
          ) {
            // Do not consider a 404 on the main pdf url as pdf caching failure.
            // Still, bail out during the initial launch phase.
            metrics.failedOnce = true
            throw new PDFJS.MissingPDFException()
          }
          metrics.failedCount++
          metrics.failedOnce = true
          if (!enablePdfCaching) {
            throw err // This was a fallback request already. Do not retry.
          }
          err = OError.tag(err, 'optimized pdf download error', errorInfo)
          console.error(err)
          captureException(err, { tags: { fromPdfCaching: true } })
          return fallbackRequest({ url: this.url, start, end, abortSignal })
        })
        .then(blob => {
          if (abortSignal.aborted) return
          this.onDataRange(start, blob)
        })
        .catch(err => {
          if (abortSignal.aborted) return
          err = OError.tag(err, 'fatal pdf download error', errorInfo)
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
    return new PDFDataRangeTransport({
      url,
      pdfFile,
      abortController,
      handleFetchError,
    })
  }
}
