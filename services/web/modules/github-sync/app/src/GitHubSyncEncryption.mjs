import crypto from 'node:crypto'
import Settings from '@overleaf/settings'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get encryption secret from settings
 * @returns {Buffer}
 */
function getSecret() {
  const secret = Settings.githubSyncEncryptionSecret
  if (!secret) {
    throw new Error('GITHUB_SYNC_ENCRYPTION_SECRET is not configured')
  }
  // Convert hex string to buffer (64 hex chars = 32 bytes)
  return Buffer.from(secret, 'hex')
}

/**
 * Encrypt a GitHub PAT for storage
 * @param {string} pat - The plaintext PAT
 * @returns {string} - Base64 encoded encrypted string (iv + authTag + ciphertext)
 */
function encrypt(pat) {
  const secret = getSecret()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv)

  let encrypted = cipher.update(pat, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Combine iv + authTag + encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ])

  return combined.toString('base64')
}

/**
 * Decrypt a stored GitHub PAT
 * @param {string} encryptedPat - Base64 encoded encrypted string
 * @returns {string} - The plaintext PAT
 */
function decrypt(encryptedPat) {
  const secret = getSecret()
  const combined = Buffer.from(encryptedPat, 'base64')

  // Extract iv, authTag, and encrypted data
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, secret, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export default {
  encrypt,
  decrypt,
}
