const crypto = require('crypto')
const logger = require('logger-sharelatex')

const ALGORITHM = 'aes-256-ctr'

const keyFn = (password, salt, callback) =>
  crypto.pbkdf2(password, salt, 10000, 64, 'sha1', callback)

const keyFn32 = (password, salt, keyLength, callback) =>
  crypto.pbkdf2(password, salt, 10000, 32, 'sha1', callback)

class AccessTokenEncryptor {
  constructor(settings) {
    this.settings = settings
    this.cipherLabel = this.settings.cipherLabel
    if (this.cipherLabel && this.cipherLabel.match(/:/)) {
      throw Error('cipherLabel must not contain a colon (:)')
    }

    this.cipherPassword = this.settings.cipherPasswords[this.cipherLabel]
    if (!this.cipherPassword) {
      throw Error('cipherPassword not set')
    }
    if (this.cipherPassword.length < 16) {
      throw Error('cipherPassword too short')
    }
  }

  encryptJson(json, callback) {
    const string = JSON.stringify(json)
    crypto.randomBytes(32, (err, bytes) => {
      if (err) {
        return callback(err)
      }
      const salt = bytes.slice(0, 16)
      const iv = bytes.slice(16, 32)

      keyFn32(this.cipherPassword, salt, 32, (err, key) => {
        if (err) {
          logger.err({ err }, 'error getting Fn key')
          return callback(err)
        }

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
        const crypted =
          cipher.update(string, 'utf8', 'base64') + cipher.final('base64')

        callback(
          null,
          `${this.cipherLabel}:${salt.toString('hex')}:${crypted}:${iv.toString(
            'hex'
          )}`
        )
      })
    })
  }

  decryptToJson(encryptedJson, callback) {
    const [label, salt, cipherText, iv] = encryptedJson.split(':', 4)
    const password = this.settings.cipherPasswords[label]
    if (!password || password.length < 16) {
      return callback(new Error('invalid password'))
    }

    if (iv) {
      this.decryptToJsonV2(password, salt, cipherText, iv, callback)
    } else {
      this.decryptToJsonV1(password, salt, cipherText, callback)
    }
  }

  decryptToJsonV1(password, salt, cipherText, callback) {
    keyFn(password, Buffer.from(salt, 'hex'), (err, key) => {
      let json
      if (err) {
        logger.err({ err }, 'error getting Fn key')
        return callback(err)
      }
      // eslint-disable-next-line node/no-deprecated-api
      const decipher = crypto.createDecipher(ALGORITHM, key)
      const dec =
        decipher.update(cipherText, 'base64', 'utf8') + decipher.final('utf8')
      try {
        json = JSON.parse(dec)
      } catch (e) {
        return callback(new Error('error decrypting token'))
      }
      callback(null, json, true)
    })
  }

  decryptToJsonV2(password, salt, cipherText, iv, callback) {
    keyFn32(password, Buffer.from(salt, 'hex'), 32, (err, key) => {
      let json
      if (err) {
        logger.err({ err }, 'error getting Fn key')
        return callback(err)
      }

      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(iv, 'hex')
      )
      const dec =
        decipher.update(cipherText, 'base64', 'utf8') + decipher.final('utf8')
      try {
        json = JSON.parse(dec)
      } catch (e) {
        return callback(new Error('error decrypting token'))
      }
      callback(null, json)
    })
  }
}

module.exports = AccessTokenEncryptor
