import { callbackify } from 'node:util'
import request from './request.js'
import metrics from '@overleaf/metrics'

async function getMetric(matcher) {
  const { body } = await request.promises.request('/metrics')
  const found = body.split('\n').find(matcher)
  if (!found) return 0
  return parseInt(found.split(' ')[1], 0)
}

/* sets all metrics to zero
   https://github.com/siimon/prom-client?tab=readme-ov-file#resetting-metrics
*/
function resetMetrics() {
  metrics.register.resetMetrics()
}

export default {
  getMetric: callbackify(getMetric),
  resetMetrics,
  promises: {
    getMetric,
  },
}
