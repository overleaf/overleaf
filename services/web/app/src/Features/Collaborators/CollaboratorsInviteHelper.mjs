import logger from '@overleaf/logger'
import Crypto from 'node:crypto'
import AccessTokenEncryptor from '@overleaf/access-token-encryptor'
import Settings from '@overleaf/settings'

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

let accessTokenEncryptor
try {
  accessTokenEncryptor = new AccessTokenEncryptor(
    Settings.projectInviteEncryptorOptions
  )
} catch (error) {
  logger.error(
    {},
    'Failed to initialise Link Sharing token encryption. Please ensure OVERLEAF_INVITE_TOKEN_SECRET is set.'
  )
}

async function encryptToken(token) {
  if (!accessTokenEncryptor) {
    throw new Error('Token encryption not configured, could not encrypt token')
  }
  return accessTokenEncryptor.promises.encryptJson(token)
}

async function decryptToken(encryptedToken) {
  if (!accessTokenEncryptor) {
    throw new Error('Token encryption not configured, could not encrypt token')
  }
  return accessTokenEncryptor.promises.decryptToJson(encryptedToken)
}

export default {
  generateToken,
  hashInviteToken,
  privilegeLevelToRole,
  encryptToken,
  decryptToken,
}
