/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const crypto = require('crypto')
const V1Api = require('../V1/V1Api')
const Features = require('../../infrastructure/Features')
const Async = require('async')
const { promisify } = require('util')

// (From Overleaf `random_token.rb`)
//   Letters (not numbers! see generate_token) used in tokens. They're all
//   consonants, to avoid embarassing words (I can't think of any that use only
//   a y), and lower case "l" is omitted, because in many fonts it is
//   indistinguishable from an upper case "I" (and sometimes even the number 1).
const TOKEN_LOWERCASE_ALPHA = 'bcdfghjkmnpqrstvwxyz'
const TOKEN_NUMERICS = '123456789'
const TOKEN_ALPHANUMERICS =
  TOKEN_LOWERCASE_ALPHA + TOKEN_LOWERCASE_ALPHA.toUpperCase() + TOKEN_NUMERICS

// This module mirrors the token generation in Overleaf (`random_token.rb`),
// for the purposes of implementing token-based project access, like the
// 'unlisted-projects' feature in Overleaf

const TokenGenerator = {
  _randomString(length, alphabet) {
    const result = crypto
      .randomBytes(length)
      .toJSON()
      .data.map(b => alphabet[b % alphabet.length])
      .join('')
    return result
  },

  // Generate a 12-char token with only characters from TOKEN_LOWERCASE_ALPHA,
  // suitable for use as a read-only token for a project
  readOnlyToken() {
    return TokenGenerator._randomString(12, TOKEN_LOWERCASE_ALPHA)
  },

  // Generate a longer token, with a numeric prefix,
  // suitable for use as a read-and-write token for a project
  readAndWriteToken() {
    const numerics = TokenGenerator._randomString(10, TOKEN_NUMERICS)
    const token = TokenGenerator._randomString(12, TOKEN_LOWERCASE_ALPHA)
    const fullToken = `${numerics}${token}`
    return { token: fullToken, numericPrefix: numerics }
  },

  generateReferralId() {
    return TokenGenerator._randomString(16, TOKEN_ALPHANUMERICS)
  },

  generateUniqueReadOnlyToken(callback) {
    if (callback == null) {
      callback = function () {}
    }
    return Async.retry(
      10,
      function (cb) {
        const token = TokenGenerator.readOnlyToken()

        if (!Features.hasFeature('saas')) {
          return cb(null, token)
        }

        return V1Api.request(
          {
            url: `/api/v1/overleaf/docs/read_token/${token}/exists`,
            json: true,
          },
          function (err, response, body) {
            if (err != null) {
              return cb(err)
            }
            if (response.statusCode !== 200) {
              return cb(
                new Error(
                  `non-200 response from v1 read-token-exists api: ${response.statusCode}`
                )
              )
            }
            if (body.exists === true) {
              return cb(new Error(`token already exists in v1: ${token}`))
            } else {
              return cb(null, token)
            }
          }
        )
      },
      callback
    )
  },
}

TokenGenerator.promises = {
  generateUniqueReadOnlyToken: promisify(
    TokenGenerator.generateUniqueReadOnlyToken
  ),
}
module.exports = TokenGenerator
