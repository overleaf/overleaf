import Crypto from 'node:crypto'

function generateToken() {
  const buffer = Crypto.randomBytes(24)
  return buffer.toString('hex')
}

function hashInviteToken(token) {
  return Crypto.createHmac('sha256', 'overleaf-token-invite')
    .update(token)
    .digest('hex')
}

function privilegeLevelToRole(privilegeLevel) {
  switch (privilegeLevel) {
    case 'readOnly':
      return 'Viewer'
    case 'readAndWrite':
      return 'Editor'
    case 'review':
      return 'Reviewer'
    default:
      return privilegeLevel
  }
}

export default {
  generateToken,
  hashInviteToken,
  privilegeLevelToRole,
}
