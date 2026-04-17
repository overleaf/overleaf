import { callbackify } from 'node:util'
import request from './request.js'
import metrics from '@overleaf/metrics'

/**
 * @param {(s: string) => bool} matcher
 * @return {Promise<number>}
 */
async function getMetric(matcher) {
  const { body } = await request.promises.request('/metrics')
  const found = body.split('\n').find(matcher)
  if (!found) return 0
  return parseInt(found.split(' ')[1], 0)
}

/**
 * @param {(s: string) => bool} matcher
 * @return {Promise<number>}
 */
async function sumMetrics(matcher) {
  const { body = '' } = await request.promises.request('/metrics')
  const found = body.split('\n').filter(matcher)
  return found.reduce((sum, next) => sum + parseInt(next.split(' ')[1], 0), 0)
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
    sumMetrics,
  },
}
