import { fallbackRequest, fetchRange } from './pdf-caching'
import getMeta from '../../../utils/meta'
import { captureException } from '../../../infrastructure/error-reporter'
import { getPdfCachingMetrics } from './metrics'

export function generatePdfCachingTransportFactory(PDFJS) {
  if (getMeta('ol-pdfCachingMode') !== 'enabled') {
    return () => null
  }
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
  })
  const verifyChunks =
    new URLSearchParams(window.location.search).get('verify_chunks') === 'true'

  class PDFDataRangeTransport extends PDFJS.PDFDataRangeTransport {
    constructor(url, pdfFile, reject) {
      super(pdfFile.size, new Uint8Array())
      this.url = url
      this.pdfFile = pdfFile
      this.reject = reject
    }

    requestDataRange(start, end) {
      fetchRange({
        url: this.url,
        start,
        end,
        file: this.pdfFile,
        metrics,
        cached,
        verifyChunks,
      })
        .catch(err => {
          metrics.failedCount++
          console.error('optimized pdf download error', err)
          captureException(err)
          return fallbackRequest({ url: this.url, start, end })
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
    return new PDFDataRangeTransport(url, pdfFile, reject)
  }
}
