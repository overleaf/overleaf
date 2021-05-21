import { v4 as uuid } from 'uuid'
import { sendMBSampled } from '../../../infrastructure/event-tracking'

const pdfJsMetrics = {
  id: uuid(),
  epoch: Date.now(),
  totalBandwidth: 0,
}

const SAMPLING_RATE = 0.01

export function trackPdfDownload(response) {
  const { serviceWorkerMetrics, stats, timings } = response

  const t0 = performance.now()
  let bandwidth = 0
  function firstRenderDone({ timePDFFetched, timePDFRendered }) {
    const latencyFetch = timePDFFetched - t0
    // The renderer does not yield in case the browser tab is hidden.
    // It will yield when the browser tab is visible again.
    // This will skew our performance metrics for rendering!
    const latencyRender = timePDFRendered - timePDFFetched
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
  sl_console.log('/event/compile-metrics', JSON.stringify(metrics))
  sendMBSampled('compile-metrics', metrics, SAMPLING_RATE)
}

function submitPDFBandwidth(metrics) {
  sl_console.log('/event/pdf-bandwidth', JSON.stringify(metrics))
  sendMBSampled('pdf-bandwidth', metrics, SAMPLING_RATE)
}
