const { callbackify, promisify } = require('util')
const JWT = require('jsonwebtoken')
const Settings = require('@overleaf/settings')

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

function getDecoded(token) {
  const key = Settings.jwt.key
  const decoded = JWT.verify(token, key)
  return decoded
}

module.exports = {
  sign: callbackify(sign),
  getDecoded,
  promises: {
    sign,
  },
}
