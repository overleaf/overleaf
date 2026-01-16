const crypto = require('node:crypto')
const { shouldSkipMetrics } = require('./Metrics')

/**
 * Consistently sample a keyspace with a given sample percentage.
 * The same key will always produce a consistent percentile value that
 * can be compared against the sample percentage.
 * Example: if key is the userId and the samplePercentage is 10, then
 * we see all the activity for the 10% of users who are selected.
 *
 * @param {string} key - The unique identifier to be hashed and checked.
 * @param {number} samplePercentage - The percentage (0-100) of keys that should return true.
 * @returns {boolean} - True if the key is within the sample, false otherwise.
 */
function sampleByHash(key, samplePercentage) {
  if (samplePercentage <= 0) {
    return false
  }
  const hash = crypto.createHash('md5').update(key).digest()
  const hashValue = hash.readUInt32BE(0)
  const percentile = Math.floor((hashValue / 0xffffffff) * 100)
  return percentile < samplePercentage
}

/**
 * Determines whether a given request should be sampled based on user ID and sampling percentage.
 * The request will not be sampled if it lacks a user_id, if its metrics path is in the exclusion list,
 * or if the sampling percentage is zero or less.
 *
 * @param {object} request - The request object to check.
 * @param {string} [request.user_id] - The ID of the user making the request.
 * @param {object} [request.metricsOpts] - Metrics options for the request.
 * @param {string} [request.metricsOpts.path] - The path associated with the request metrics.
 * @param {number} samplingPercentage - The percentage of requests to sample (e.g., 10 for 10%).
 * @returns {boolean|undefined} The result from sampleByHash if the request is eligible for sampling, otherwise undefined.
 */
function sampleRequest(request, samplingPercentage) {
  if (!request.user_id) {
    return
  }
  if (shouldSkipMetrics(request)) {
    return
  }
  if (samplingPercentage > 0) {
    return sampleByHash(request.user_id, samplingPercentage)
  }
}

module.exports = { sampleByHash, sampleRequest }
