const chai = require('chai')
chai.should()
const { expect } = chai
const modulePath = '../../../index.js'
const SandboxedModule = require('sandboxed-module')

describe('AccessTokenEncryptor', function () {
  beforeEach(function () {
    this.testObject = { hello: 'world' }
    this.encrypted2015 =
      '2015.1:473a66fb5d816bc716f278ab819d88a5:+mTg7O9sgUND8pNQFG6h2GE='
    this.encrypted2016 =
      '2016.1:76a7d64a444ccee1a515b49c44844a69:m5YSkexUsLjcF4gLncm72+k='
    this.encrypted2019 =
      '2019.1:627143b2ab185a020c8720253a4c984e:7gnY6Ez3/Y3UWgLHLfBtJsE=:bf75cecb6aeea55b3c060e1122d2a82d'
    this.encrypted2023 =
      '2023.1-v3:a6dd3781dd6ce93a4134874b505a209c:9TdIDAc8V9SeR0ffSn63Jj4=:d8b2de0b733c81b949993dce229abb4c'
    this.badLabel = 'xxxxxx:c7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q='
    this.badKey = '2015.1:d7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q='
    this.badCipherText = '2015.1:c7a39310056b694c:xQf+Uh5Den3JREtvc82GW5Q='
    this.settings = {
      cipherLabel: '2023.1-v3',
      cipherPasswords: {
        '2023.1-v3': '44444444444444444444444444444444444444',
      },
    }
    this.AccessTokenEncryptor = SandboxedModule.require(modulePath, {
      globals: {
        Buffer,
      },
    })
    this.encryptor = new this.AccessTokenEncryptor(this.settings)
  })

  describe('invalid settings', function () {
    it('should flag missing label', function () {
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '',
            cipherPasswords: { '': '' },
          })
      ).to.throw(/cipherLabel cannot be empty/)
    })

    it('should flag invalid label with colon', function () {
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '2023:1-v2',
            cipherPasswords: { '2023:1-v2': '' },
          })
      ).to.throw(/colon/)
    })

    it('should flag missing password', function () {
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherPasswords: { '2023.1-v3': '' },
            cipherVersions: { '2023.1-v3': 'v3' },
          })
      ).to.throw(/cipherPasswords.+ missing/)
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '2023.1-v3',
            cipherPasswords: { '2023.1-v3': undefined },
          })
      ).to.throw(/cipherPasswords.+ missing/)
    })

    it('should flag short password', function () {
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '2023.1-v3',
            cipherPasswords: { '2023.1-v3': 'foo' },
          })
      ).to.throw(/cipherPasswords.+ too short/)
    })

    it('should flag missing version', function () {
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '2023.1',
            cipherPasswords: { 2023.1: '11111111111111111111111111111111' },
          })
      ).to.throw(/must contain version suffix/)
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '2023.1-',
            cipherPasswords: { '2023.1-': '11111111111111111111111111111111' },
          })
      ).to.throw(/must contain version suffix/)
    })

    it('should flag invalid version', function () {
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '2023.1-v0',
            cipherPasswords: {
              '2023.1-v0': '11111111111111111111111111111111',
            },
          })
      ).to.throw(/unknown version/)
    })

    it('should flag unknown default scheme', function () {
      expect(
        () =>
          new this.AccessTokenEncryptor({
            cipherLabel: '2000.1-v3',
            cipherPasswords: {
              '2023.1-v3': '11111111111111111111111111111111',
            },
          })
      ).to.throw(/unknown default cipherLabel/)
    })
  })

  describe('encrypt', function () {
    it('should encrypt the object', function (done) {
      this.encryptor.encryptJson(this.testObject, (err, encrypted) => {
        expect(err).to.be.null
        encrypted.should.match(
          /^2023.1-v3:[0-9a-f]{32}:[a-zA-Z0-9=+/]+:[0-9a-f]{32}$/
        )
        done()
      })
    })

    it('should encrypt the object differently the next time', function (done) {
      this.encryptor.encryptJson(this.testObject, (err, encrypted1) => {
        expect(err).to.be.null
        this.encryptor.encryptJson(this.testObject, (err, encrypted2) => {
          expect(err).to.be.null
          encrypted1.should.not.equal(encrypted2)
          done()
        })
      })
    })
  })

  describe('decrypt', function () {
    it('should decrypt the string to get the same object', function (done) {
      this.encryptor.encryptJson(this.testObject, (err, encrypted) => {
        expect(err).to.be.null
        this.encryptor.decryptToJson(encrypted, (err, decrypted) => {
          expect(err).to.be.null
          expect(decrypted).to.deep.equal(this.testObject)
          done()
        })
      })
    })

    it('should not be able to decrypt 2015 string', function (done) {
      this.encryptor.decryptToJson(this.encrypted2015, (err, decrypted) => {
        expect(err).to.exist
        expect(err.message).to.equal(
          'unknown access-token-encryptor label 2015.1'
        )
        expect(decrypted).to.not.exist
        done()
      })
    })

    it('should not be able to decrypt a 2016 string', function (done) {
      this.encryptor.decryptToJson(this.encrypted2016, (err, decrypted) => {
        expect(err).to.exist
        expect(err.message).to.equal(
          'unknown access-token-encryptor label 2016.1'
        )
        expect(decrypted).to.not.exist
        done()
      })
    })

    it('should not be able to decrypt a 2019 string', function (done) {
      this.encryptor.decryptToJson(this.encrypted2019, (err, decrypted) => {
        expect(err).to.exist
        expect(err.message).to.equal(
          'unknown access-token-encryptor label 2019.1'
        )
        expect(decrypted).to.not.exist
        done()
      })
    })

    it('should decrypt an 2023 string to get the same object', function (done) {
      this.encryptor.decryptToJson(this.encrypted2023, (err, decrypted) => {
        expect(err).to.be.null
        expect(decrypted).to.deep.equal(this.testObject)
        done()
      })
    })

    it('should return an error when decrypting an invalid label', function (done) {
      this.encryptor.decryptToJson(this.badLabel, (err, decrypted) => {
        expect(err).to.be.instanceof(Error)
        expect(decrypted).to.be.undefined
        done()
      })
    })

    it('should return an error when decrypting an invalid key', function (done) {
      this.encryptor.decryptToJson(this.badKey, (err, decrypted) => {
        expect(err).to.be.instanceof(Error)
        expect(decrypted).to.be.undefined
        done()
      })
    })

    it('should return an error when decrypting an invalid ciphertext', function (done) {
      this.encryptor.decryptToJson(this.badCipherText, (err, decrypted) => {
        expect(err).to.be.instanceof(Error)
        expect(decrypted).to.be.undefined
        done()
      })
    })
  })
})
