const crypto = require('node:crypto')

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

module.exports = { sampleByHash }
