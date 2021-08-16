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
    this.badLabel = 'xxxxxx:c7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q='
    this.badKey = '2015.1:d7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q='
    this.badCipherText = '2015.1:c7a39310056b694c:xQf+Uh5Den3JREtvc82GW5Q='
    this.settings = {
      cipherLabel: '2019.1',
      cipherPasswords: {
        2016.1: '11111111111111111111111111111111111111',
        2015.1: '22222222222222222222222222222222222222',
        2019.1: '33333333333333333333333333333333333333',
      },
    }
    this.AccessTokenEncryptor = SandboxedModule.require(modulePath, {
      globals: {
        Buffer,
      },
      requires: {
        'logger-sharelatex': {
          err() {},
        },
      },
    })
    this.encryptor = new this.AccessTokenEncryptor(this.settings)
  })

  describe('encrypt', function () {
    it('should encrypt the object', function (done) {
      this.encryptor.encryptJson(this.testObject, (err, encrypted) => {
        expect(err).to.be.null
        encrypted.should.match(
          /^2019.1:[0-9a-f]{32}:[a-zA-Z0-9=+/]+:[0-9a-f]{32}$/
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

    it('should decrypt an 2015 string to get the same object', function (done) {
      this.encryptor.decryptToJson(this.encrypted2015, (err, decrypted) => {
        expect(err).to.be.null
        expect(decrypted).to.deep.equal(this.testObject)
        done()
      })
    })

    it('should decrypt an 2016 string to get the same object', function (done) {
      this.encryptor.decryptToJson(this.encrypted2016, (err, decrypted) => {
        expect(err).to.be.null
        expect(decrypted).to.deep.equal(this.testObject)
        done()
      })
    })

    it('should decrypt an 2019 string to get the same object', function (done) {
      this.encryptor.decryptToJson(this.encrypted2019, (err, decrypted) => {
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
