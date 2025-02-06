// @ts-check

const { createHash } = require('node:crypto')

/**
 * Compute a SHA-1 hash of the content
 *
 * This is used to validate incoming updates.
 *
 * @param {string} content
 */
function getContentHash(content) {
  const hash = createHash('sha-1')
  hash.update(content)
  return hash.digest('hex')
}

module.exports = { getContentHash }
