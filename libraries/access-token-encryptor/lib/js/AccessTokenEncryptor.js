const { promisify } = require('node:util')
const crypto = require('node:crypto')

const ALGORITHM = 'aes-256-ctr'

const cryptoHkdf = promisify(crypto.hkdf)
const cryptoRandomBytes = promisify(crypto.randomBytes)

class AbstractAccessTokenScheme {
  constructor(cipherLabel, cipherPassword) {
    this.cipherLabel = cipherLabel
    this.cipherPassword = cipherPassword
  }

  /**
   * @param {Object} json
   * @return {Promise<string>}
   */
  async encryptJson(json) {
    throw new Error('encryptJson is not implemented')
  }

  /**
   * @param {string} encryptedJson
   * @return {Promise<Object>}
   */
  async decryptToJson(encryptedJson) {
    throw new Error('decryptToJson is not implemented')
  }
}

class AccessTokenSchemeWithGenericKeyFn extends AbstractAccessTokenScheme {
  /**
   * @param {Buffer} salt
   * @return {Promise<Buffer>}
   */
  async keyFn(salt) {
    throw new Error('keyFn is not implemented')
  }

  async encryptJson(json) {
    const plainText = JSON.stringify(json)

    const bytes = await cryptoRandomBytes(32)
    const salt = bytes.slice(0, 16)
    const iv = bytes.slice(16, 32)
    const key = await this.keyFn(salt)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const cipherText =
      cipher.update(plainText, 'utf8', 'base64') + cipher.final('base64')

    return [
      this.cipherLabel,
      salt.toString('hex'),
      cipherText,
      iv.toString('hex'),
    ].join(':')
  }

  async decryptToJson(encryptedJson) {
    const [, salt, cipherText, iv] = encryptedJson.split(':', 4)
    const key = await this.keyFn(Buffer.from(salt, 'hex'))

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    )
    const plainText =
      decipher.update(cipherText, 'base64', 'utf8') + decipher.final('utf8')
    try {
      return JSON.parse(plainText)
    } catch (e) {
      throw new Error('error decrypting token')
    }
  }
}

class AccessTokenSchemeV3 extends AccessTokenSchemeWithGenericKeyFn {
  async keyFn(salt) {
    const optionalInfo = ''
    return await cryptoHkdf(
      'sha512',
      this.cipherPassword,
      salt,
      optionalInfo,
      32
    )
  }
}

class AccessTokenEncryptor {
  constructor(settings) {
    /**
     * @type {Map<string, AbstractAccessTokenScheme>}
     */
    this.schemeByCipherLabel = new Map()
    for (const cipherLabel of Object.keys(settings.cipherPasswords)) {
      if (!cipherLabel) {
        throw new Error('cipherLabel cannot be empty')
      }
      if (cipherLabel.match(/:/)) {
        throw new Error(
          `cipherLabel must not contain a colon (:), got ${cipherLabel}`
        )
      }
      const [, version] = cipherLabel.split('-')
      if (!version) {
        throw new Error(
          `cipherLabel must contain version suffix (e.g. 2042.1-v42), got ${cipherLabel}`
        )
      }

      const cipherPassword = settings.cipherPasswords[cipherLabel]
      if (!cipherPassword) {
        throw new Error(`cipherPasswords['${cipherLabel}'] is missing`)
      }
      if (cipherPassword.length < 16) {
        throw new Error(`cipherPasswords['${cipherLabel}'] is too short`)
      }

      let scheme
      switch (version) {
        case 'v3':
          scheme = new AccessTokenSchemeV3(cipherLabel, cipherPassword)
          break
        default:
          throw new Error(`unknown version '${version}' for ${cipherLabel}`)
      }
      this.schemeByCipherLabel.set(cipherLabel, scheme)
    }

    /** @type {AbstractAccessTokenScheme} */
    this.defaultScheme = this.schemeByCipherLabel.get(settings.cipherLabel)
    if (!this.defaultScheme) {
      throw new Error(`unknown default cipherLabel ${settings.cipherLabel}`)
    }
  }

  promises = {
    encryptJson: async json => await this.defaultScheme.encryptJson(json),
    decryptToJson: async encryptedJson => {
      const [label] = encryptedJson.split(':', 1)
      const scheme = this.schemeByCipherLabel.get(label)
      if (!scheme) {
        throw new Error('unknown access-token-encryptor label ' + label)
      }
      return await scheme.decryptToJson(encryptedJson)
    },
  }

  encryptJson(json, callback) {
    this.promises.encryptJson(json).then(s => callback(null, s), callback)
  }

  decryptToJson(encryptedJson, callback) {
    this.promises
      .decryptToJson(encryptedJson)
      .then(o => callback(null, o), callback)
  }
}

module.exports = AccessTokenEncryptor
