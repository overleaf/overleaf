import { callbackify, promisify } from 'node:util'
import JWT from 'jsonwebtoken'
import Settings from '@overleaf/settings'

const jwtSign = promisify(JWT.sign)

async function sign(payload, options = {}) {
  const key = Settings.jwt.key
  const algorithm = Settings.jwt.algorithm
  if (!key || !algorithm) {
    throw new Error('missing JWT configuration')
  }
  const token = await jwtSign(payload, key, { ...options, algorithm })
  return token
}

function getDecoded(token, options = {}) {
  const key = Settings.jwt.key
  const decoded = JWT.verify(token, key, {
    ignoreExpiration: options.ignoreExpiration,
  })
  return decoded
}

export default {
  sign: callbackify(sign),
  getDecoded,
  promises: {
    sign,
  },
}
