sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../index.js"
SandboxedModule = require('sandboxed-module')
path = require('path')

describe 'AccessTokenEncryptor', ->

	beforeEach ->
		@testObject = {"hello":"world"}
		@encrypted2015 = "2015.1:473a66fb5d816bc716f278ab819d88a5:+mTg7O9sgUND8pNQFG6h2GE="
		@encrypted2016 = "2016.1:76a7d64a444ccee1a515b49c44844a69:m5YSkexUsLjcF4gLncm72+k="
		@badLabel = "xxxxxx:c7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q="
		@badKey = "2015.1:d7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q="
		@badCipherText = "2015.1:c7a39310056b694c:xQf+Uh5Den3JREtvc82GW5Q="
		@settings =
			cipherLabel: "2019.1"
			cipherPasswords:
				"2016.1": "11111111111111111111111111111111111111"
				"2015.1": "22222222222222222222222222222222222222"
				"2019.1": "33333333333333333333333333333333333333"
		AccessTokenEncryptor = SandboxedModule.require modulePath
		@encryptor = new AccessTokenEncryptor(@settings)

	describe "encrypt", ->
		it 'should encrypt the object', (done)->
			@encryptor.encryptJson @testObject, (err, encrypted)->
				expect(err).to.be.null
				encrypted.should.match(/^2019.1:[0-9a-f]+:[a-zA-Z0-9=+\/]+:[0-9a-f]+$/)
				done()

		it 'should encrypt the object differently the next time', (done)->
			@encryptor.encryptJson @testObject, (err, encrypted1)=>
				@encryptor.encryptJson @testObject, (err, encrypted2)=>
					encrypted1.should.not.equal(encrypted2)
					done()

	describe "decrypt", ->
		it 'should decrypt the string to get the same object', (done)->
			@encryptor.encryptJson @testObject, (err, encrypted) =>
				expect(err).to.be.null
				@encryptor.decryptToJson encrypted, (err, decrypted) =>
					expect(err).to.be.null
					expect(decrypted).to.deep.equal @testObject
					done()

		it 'should decrypt an 2015 string to get the same object', (done)->
			@encryptor.decryptToJson @encrypted2015, (err, decrypted)=>
				expect(err).to.be.null
				expect(decrypted).to.deep.equal @testObject
				done()

		it 'should decrypt an 2016 string to get the same object', (done)->
			@encryptor.decryptToJson @encrypted2016, (err, decrypted)=>
				expect(err).to.be.null
				expect(decrypted).to.deep.equal @testObject
				done()

		it 'should return an error when decrypting an invalid label', (done)->
			@encryptor.decryptToJson @badLabel, (err, decrypted)->
				expect(err).to.be.instanceof(Error)
				expect(decrypted).to.be.undefined
				done()

		it 'should return an error when decrypting an invalid key', (done)->
			@encryptor.decryptToJson @badKey, (err, decrypted)->
				expect(err).to.be.instanceof(Error)
				expect(decrypted).to.be.undefined
				done()

		it 'should return an error when decrypting an invalid ciphertext',(done)->
			@encryptor.decryptToJson	@badCipherText, (err, decrypted)->
				expect(err).to.be.instanceof(Error)
				expect(decrypted).to.be.undefined
				done()
