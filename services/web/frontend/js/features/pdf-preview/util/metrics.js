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

export function trackPdfDownload(response, compileTimeClientE2E) {
  const { stats, timings } = response

  const t0 = performance.now()
  const deliveryLatencies = {
    compileTimeClientE2E,
    compileTimeServerE2E: timings?.compileE2E,
  }

  function firstRenderDone({ timePDFFetched, timePDFRendered }) {
    const latencyFetch = Math.ceil(timePDFFetched - t0)
    deliveryLatencies.latencyFetch = latencyFetch
    // The renderer does not yield in case the browser tab is hidden.
    // It will yield when the browser tab is visible again.
    // This will skew our performance metrics for rendering!
    // We are omitting the render time in case we detect this state.
    let latencyRender
    if (timePDFRendered) {
      latencyRender = Math.ceil(timePDFRendered - timePDFFetched)
      deliveryLatencies.latencyRender = latencyRender
    }
    done({ latencyFetch, latencyRender })
  }
  let done
  const onFirstRenderDone = new Promise(resolve => {
    done = resolve
  })

  if (getMeta('ol-trackPdfDownload')) {
    // Submit latency along with compile context.
    onFirstRenderDone.then(({ latencyFetch, latencyRender }) => {
      submitCompileMetrics({
        latencyFetch,
        latencyRender,
        compileTimeClientE2E,
        stats,
        timings,
      })
    })
  }

  return {
    deliveryLatencies,
    firstRenderDone,
  }
}

function submitCompileMetrics(metrics) {
  const { latencyFetch, latencyRender, compileTimeClientE2E } = metrics
  const leanMetrics = {
    version: VERSION,
    latencyFetch,
    latencyRender,
    compileTimeClientE2E,
    id: EDITOR_SESSION_ID,
    ...(pdfCachingMetrics || {}),
  }
  sl_console.log('/event/compile-metrics', JSON.stringify(metrics))
  sendMB('compile-metrics-v6', leanMetrics)
}
