import crypto from 'node:crypto'
import * as jose from 'jose'
import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'

const COOKIE_NAME = Settings.deviceHistory.cookieName
const ENTRY_EXPIRY = Settings.deviceHistory.entryExpiry
const MAX_ENTRIES = Settings.deviceHistory.maxEntries

let SECRET
if (Settings.deviceHistory.secret) {
  SECRET = crypto.createSecretKey(
    Buffer.from(Settings.deviceHistory.secret, 'hex')
  )
}
const CONTENT_ENCRYPTION_ALGORITHM = 'A256GCM'
const KEY_MANAGEMENT_ALGORITHM = 'A256GCMKW'
const ENCRYPTION_HEADER = {
  alg: KEY_MANAGEMENT_ALGORITHM,
  enc: CONTENT_ENCRYPTION_ALGORITHM,
}
const DECRYPTION_OPTIONS = {
  contentEncryptionAlgorithms: [CONTENT_ENCRYPTION_ALGORITHM],
  keyManagementAlgorithms: [KEY_MANAGEMENT_ALGORITHM],
}

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

class DeviceHistory {
  constructor() {
    this.entries = []
  }

  has(email) {
    return this.entries.some(entry => entry.e === email)
  }

  add(email) {
    // Entries are sorted by age, starting from oldest (idx 0) to newest.
    // When parsing/serializing we are looking at the last n=MAX_ENTRIES entries
    //  from the list and discard any other stale entries.
    this.entries = this.entries.filter(entry => entry.e !== email)
    this.entries.push({ e: email, t: Date.now() })
  }

  async serialize(res) {
    let v = ''
    if (this.entries.length > 0 && SECRET) {
      v = await new jose.CompactEncrypt(
        ENCODER.encode(JSON.stringify(this.entries.slice(-MAX_ENTRIES)))
      )
        .setProtectedHeader(ENCRYPTION_HEADER)
        .encrypt(SECRET)
    }

    const options = {
      domain: Settings.cookieDomain,
      maxAge: ENTRY_EXPIRY,
      secure: Settings.secureCookie,
      sameSite: Settings.sameSiteCookie,
      httpOnly: true,
      path: '/login',
    }
    if (v) {
      res.cookie(COOKIE_NAME, v, options)
    } else {
      options.maxAge = -1
      res.clearCookie(COOKIE_NAME, options)
    }
  }

  async parse(req) {
    const blob = req.cookies[COOKIE_NAME]
    if (!blob || !SECRET) {
      Metrics.inc('device_history', 1, { status: 'missing' })
      return
    }
    try {
      const { plaintext } = await jose.compactDecrypt(
        blob,
        SECRET,
        DECRYPTION_OPTIONS
      )
      const minTimestamp = Date.now() - ENTRY_EXPIRY
      this.entries = JSON.parse(DECODER.decode(plaintext))
        .slice(-MAX_ENTRIES)
        .filter(entry => entry.t > minTimestamp)
    } catch (err) {
      Metrics.inc('device_history', 1, { status: 'failure' })
      throw err
    }
    if (this.entries.length === MAX_ENTRIES) {
      // Track hitting the limit, we might need to increase the limit.
      Metrics.inc('device_history_at_limit')
    }
    // Collect quantiles of the size
    Metrics.summary('device_history_size', this.entries.length)
    Metrics.inc('device_history', 1, { status: 'success' })
  }
}

export default DeviceHistory
