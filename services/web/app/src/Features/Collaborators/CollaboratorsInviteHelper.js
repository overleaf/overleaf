const Crypto = require('crypto')

function hashInviteToken(token) {
  return Crypto.createHmac('sha256', 'overleaf-token-invite')
    .update(token)
    .digest('hex')
}

module.exports = {
  hashInviteToken,
}
