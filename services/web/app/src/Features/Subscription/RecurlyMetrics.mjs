import Metrics from '@overleaf/metrics'

/**
 * @param {number} status
 * @param {number} rateLimit
 * @param {number} rateLimitRemaining
 * @param {number} rateLimitReset
 */
function recordMetrics(status, rateLimit, rateLimitRemaining, rateLimitReset) {
  Metrics.inc('recurly_request', 1, { status })
  const metrics = { rateLimit, rateLimitRemaining, rateLimitReset }
  for (const [method, v] of Object.entries(metrics)) {
    if (Number.isNaN(v)) continue
    Metrics.gauge('recurly_request_rate_limiting', v, 1, { method })
  }
}

/**
 * @param {Response} response
 */
function recordMetricsFromResponse(response) {
  const rateLimit = parseInt(
    response.headers.get('X-RateLimit-Limit') || '',
    10
  )
  const rateLimitRemaining = parseInt(
    response.headers.get('X-RateLimit-Remaining') || '',
    10
  )
  const rateLimitReset =
    parseInt(response.headers.get('X-RateLimit-Reset') || '', 10) * 1000
  recordMetrics(response.status, rateLimit, rateLimitRemaining, rateLimitReset)
}

export default {
  recordMetrics,
  recordMetricsFromResponse,
}
