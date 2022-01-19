/*
  This module is operating on raw user passwords. Be very defensive.
  Pay special attention when passing the password or even a hash/prefix around.
  We need to ensure that no parts of it get logged or returned on either the
   happy path or via an error (message or attributes).
 */

const request = require('request-promise-native')
const crypto = require('crypto')
const Settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')

const HEX_CHARS_UPPER = '1234567890ABCDEF'
const API_ERROR = new Error('cannot contact HaveIBeenPwned api')
const INVALID_PREFIX = new Error(
  'This is not a valid hex prefix. Rejecting to pass it to HaveIBeenPwned'
)
const INVALID_RESPONSE = new Error('cannot consume HaveIBeenPwned api response')
const INVALID_SCORE = new Error(
  'non integer score returned by HaveIBeenPwned api'
)
const CODED_ERROR_MESSAGES = [
  API_ERROR,
  INVALID_PREFIX,
  INVALID_RESPONSE,
  INVALID_SCORE,
].map(err => err.message)

async function getScoresForPrefix(prefix) {
  if (
    typeof prefix !== 'string' ||
    prefix.length !== 5 ||
    Array.from(prefix).some(c => !HEX_CHARS_UPPER.includes(c))
  ) {
    // Make sure we do not pass arbitrary objects to the api.
    throw INVALID_PREFIX
  }
  try {
    return await request({
      uri: `${Settings.apis.haveIBeenPwned.url}/range/${prefix}`,
      headers: {
        'User-Agent': 'www.overleaf.com',
        // Docs: https://haveibeenpwned.com/API/v3#PwnedPasswordsPadding
        'Add-Padding': true,
      },
      timeout: Settings.apis.haveIBeenPwned.timeout,
    })
  } catch (_errorWithPotentialReferenceToPrefix) {
    // NOTE: Do not leak request details by passing the original error up.
    throw API_ERROR
  }
}

async function isPasswordReused(password) {
  const sha1 = crypto
    .createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase()
  const prefix = sha1.slice(0, 5)
  const body = await getScoresForPrefix(prefix)

  let score = 0
  try {
    for (const line of body.split('\r\n')) {
      const [candidate, scoreRaw] = line.split(':')
      if (prefix + candidate === sha1) {
        score = parseInt(scoreRaw)
        break
      }
    }
  } catch (_errorWithPotentialReferenceToHash) {
    // NOTE: Do not leak password details by logging the original error.
    throw INVALID_RESPONSE
  }

  if (Number.isNaN(score)) {
    // NOTE: Do not leak password details by logging the score.
    throw INVALID_SCORE
  }
  return score > 0
}

function checkPasswordForReuseInBackground(password) {
  if (!Settings.apis.haveIBeenPwned.enabled) {
    return
  }

  isPasswordReused(password)
    .then(isReused => {
      Metrics.inc('password_re_use', 1, {
        status: isReused ? 're-used' : 'unique',
      })
    })
    .catch(err => {
      // Make sure we do not leak any password details.
      if (!CODED_ERROR_MESSAGES.includes(err.message)) {
        err = new Error('hidden message')
      }
      err = new Error(err.message)

      logger.err({ err }, 'cannot check password for re-use')
      Metrics.inc('password_re_use', 1, { status: 'failure' })
    })
}

module.exports = {
  checkPasswordForReuseInBackground,
}
