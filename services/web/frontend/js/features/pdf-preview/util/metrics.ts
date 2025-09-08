import { v4 as uuid } from 'uuid'
import { sendMB } from '../../../infrastructure/event-tracking'
import { trackPdfDownloadEnabled } from './pdf-caching-flags'
import { debugConsole } from '@/utils/debugging'
import { DeliveryLatencies, PdfCachingMetrics } from './types'
import { CompileResponseData } from '@ol-types/compile'

// VERSION should get incremented when making changes to caching behavior or
//  adjusting metrics collection.
const VERSION = 9

// editing session id
export const EDITOR_SESSION_ID = uuid()

const pdfCachingMetrics: PdfCachingMetrics = {
  viewerId: EDITOR_SESSION_ID,
}

export function getPdfCachingMetrics() {
  return pdfCachingMetrics
}

export function trackPdfDownload(
  response: CompileResponseData,
  compileTimeClientE2E: number,
  t0: number
): {
  deliveryLatencies: DeliveryLatencies
  firstRenderDone: (args: {
    latencyFetch: number
    latencyRender: number | undefined
    pdfCachingMetrics: typeof pdfCachingMetrics
  }) => void
} {
  const { timings, pdfCachingMinChunkSize } = response

  const deliveryLatencies: DeliveryLatencies = {
    compileTimeClientE2E,
    compileTimeServerE2E: timings?.compileE2E,
  }

  // There can be multiple "first" renderings with two pdf viewers.
  // E.g. two pdf detach tabs or pdf detacher plus pdf detach.
  // Let the pdfCachingMetrics round trip to account for pdf-detach.
  let isFirstRender = true
  function firstRenderDone({
    latencyFetch,
    latencyRender,
    pdfCachingMetrics,
  }: {
    latencyFetch: number
    latencyRender: number | undefined
    pdfCachingMetrics: PdfCachingMetrics
  }) {
    if (!isFirstRender) return
    isFirstRender = false

    deliveryLatencies.totalDeliveryTime = Math.ceil(performance.now() - t0)
    deliveryLatencies.latencyFetch = latencyFetch
    if (latencyRender) {
      deliveryLatencies.latencyRender = latencyRender
    }
    if (trackPdfDownloadEnabled) {
      // Submit latency along with compile context.
      submitCompileMetrics({
        pdfCachingMinChunkSize,
        ...deliveryLatencies,
        ...pdfCachingMetrics,
      })
    }
  }

  return {
    deliveryLatencies,
    firstRenderDone,
  }
}

type Metrics = DeliveryLatencies &
  PdfCachingMetrics & { pdfCachingMinChunkSize: number }

function submitCompileMetrics(metrics: Metrics) {
  const leanMetrics = {
    version: VERSION,
    ...metrics,
    id: EDITOR_SESSION_ID,
  }
  debugConsole.log('/event/compile-metrics', JSON.stringify(leanMetrics))
  sendMB('compile-metrics-v6', leanMetrics)
}
