const Crypto = require('crypto')

function generateToken() {
  const buffer = Crypto.randomBytes(24)
  return buffer.toString('hex')
}

function hashInviteToken(token) {
  return Crypto.createHmac('sha256', 'overleaf-token-invite')
    .update(token)
    .digest('hex')
}

module.exports = {
  generateToken,
  hashInviteToken,
}
