import { v4 as uuid } from 'uuid'
import { sendMB } from '../../../infrastructure/event-tracking'
import getMeta from '../../../utils/meta'

// VERSION should get incremented when making changes to caching behavior or
//  adjusting metrics collection.
const VERSION = 3

// editing session id
const EDITOR_SESSION_ID = uuid()

let pdfCachingMetrics

export function setCachingMetrics(metrics) {
  pdfCachingMetrics = metrics
}

export function trackPdfDownload(response, compileTimeClientE2E, t0) {
  const { timings } = response

  const deliveryLatencies = {
    compileTimeClientE2E,
    compileTimeServerE2E: timings?.compileE2E,
  }

  // There can be multiple "first" renderings with two pdf viewers.
  // E.g. two pdf detach tabs or pdf detacher plus pdf detach.
  let isFirstRender = true
  function firstRenderDone({ latencyFetch, latencyRender }) {
    if (!isFirstRender) return
    isFirstRender = false

    const totalDeliveryTime = Math.ceil(performance.now() - t0)
    deliveryLatencies.totalDeliveryTime = totalDeliveryTime
    deliveryLatencies.latencyFetch = latencyFetch
    if (latencyRender) {
      deliveryLatencies.latencyRender = latencyRender
    }
    if (getMeta('ol-trackPdfDownload')) {
      // Submit latency along with compile context.
      submitCompileMetrics({
        totalDeliveryTime,
        latencyFetch,
        latencyRender,
        compileTimeClientE2E,
      })
    }
  }

  return {
    deliveryLatencies,
    firstRenderDone,
  }
}

function submitCompileMetrics(metrics) {
  const leanMetrics = {
    version: VERSION,
    ...metrics,
    id: EDITOR_SESSION_ID,
    ...(pdfCachingMetrics || {}),
  }
  sl_console.log('/event/compile-metrics', JSON.stringify(metrics))
  sendMB('compile-metrics-v6', leanMetrics)
}
