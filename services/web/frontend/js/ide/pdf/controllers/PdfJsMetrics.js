import { v4 as uuid } from 'uuid'
import { sendMB } from '../../../infrastructure/event-tracking'

// VERSION should get incremented when making changes to caching behavior or
//  adjusting metrics collection.
// Keep in sync with the service worker.
const VERSION = 2

const pdfJsMetrics = {
  version: VERSION,
  id: uuid(),
  epoch: Date.now(),
  totalBandwidth: 0,
}

const SAMPLING_RATE = 0.01

export function trackPdfDownload(response, compileTimeClientE2E) {
  const { serviceWorkerMetrics, stats, timings } = response

  const t0 = performance.now()
  let bandwidth = 0
  function firstRenderDone({ timePDFFetched, timePDFRendered }) {
    const latencyFetch = timePDFFetched - t0
    // The renderer does not yield in case the browser tab is hidden.
    // It will yield when the browser tab is visible again.
    // This will skew our performance metrics for rendering!
    // We are omitting the render time in case we detect this state.
    let latencyRender
    if (timePDFRendered) {
      latencyRender = timePDFRendered - timePDFFetched
    }
    done({ latencyFetch, latencyRender })
  }
  function updateConsumedBandwidth(bytes) {
    pdfJsMetrics.totalBandwidth += bytes - bandwidth
    bandwidth = bytes
  }
  let done
  const onFirstRenderDone = new Promise(resolve => {
    done = resolve
  })

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
  // Submit bandwidth counter separate from compile context.
  submitPDFBandwidth({ pdfJsMetrics, serviceWorkerMetrics })

  return {
    firstRenderDone,
    updateConsumedBandwidth,
  }
}

function submitCompileMetrics(metrics) {
  let {
    latencyFetch,
    latencyRender,
    compileTimeClientE2E,
    stats,
    timings,
  } = metrics
  stats = stats || {}
  timings = timings || {}
  const leanMetrics = {
    version: VERSION,
    latencyFetch,
    latencyRender,
    pdfSize: stats['pdf-size'],
    compileTimeClientE2E,
    compileTimeServerE2E: timings.compileE2E,
  }
  sl_console.log('/event/compile-metrics', JSON.stringify(metrics))
  sendMB('compile-metrics-v3', leanMetrics, SAMPLING_RATE)
}

function submitPDFBandwidth(metrics) {
  const metricsFlat = {}
  Object.entries(metrics).forEach(([section, items]) => {
    if (!items) return
    Object.entries(items).forEach(([key, value]) => {
      metricsFlat[section + '_' + key] = value
    })
  })
  sl_console.log('/event/pdf-bandwidth', JSON.stringify(metrics))
  sendMB('pdf-bandwidth-v3', metricsFlat, SAMPLING_RATE)
}
