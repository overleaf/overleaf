import crypto from 'node:crypto'
import V1Api from '../V1/V1Api.mjs'
import Features from '../../infrastructure/Features.mjs'
import { callbackify } from 'node:util'

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

function _randomString(length, alphabet) {
  const result = crypto
    .randomBytes(length)
    .toJSON()
    .data.map(b => alphabet[b % alphabet.length])
    .join('')
  return result
}

// Generate a 12-char token with only characters from TOKEN_LOWERCASE_ALPHA,
// suitable for use as a read-only token for a project
function readOnlyToken() {
  return _randomString(12, TOKEN_LOWERCASE_ALPHA)
}

// Generate a longer token, with a numeric prefix,
// suitable for use as a read-and-write token for a project
function readAndWriteToken() {
  const numerics = _randomString(10, TOKEN_NUMERICS)
  const token = _randomString(12, TOKEN_LOWERCASE_ALPHA)
  const fullToken = `${numerics}${token}`
  return { token: fullToken, numericPrefix: numerics }
}

function generateReferralId() {
  return _randomString(16, TOKEN_ALPHANUMERICS)
}

async function generateUniqueReadOnlyToken() {
  const retryOperation = async () => {
    const token = readOnlyToken()

    if (!Features.hasFeature('saas')) {
      return token
    }

    const { response, body } = await V1Api.promises.request({
      url: `/api/v1/overleaf/docs/read_token/${token}/exists`,
      json: true,
    })

    if (response.statusCode !== 200) {
      throw new Error(
        `non-200 response from v1 read-token-exists api: ${response.statusCode}`
      )
    }

    if (body.exists === true) {
      throw new Error(`token already exists in v1: ${token}`)
    }

    return token
  }

  const MAX_RETRIES = 10
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await retryOperation()
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw err
      }
    }
  }
}

const TokenGenerator = {
  _randomString,
  readOnlyToken,
  readAndWriteToken,
  generateReferralId,
  generateUniqueReadOnlyToken: callbackify(generateUniqueReadOnlyToken),
}

TokenGenerator.promises = {
  generateUniqueReadOnlyToken,
}
export default TokenGenerator
