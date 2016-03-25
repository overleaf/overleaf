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
		@Encrypted = "2016.1:6e7ac79ab13a18b5749eace965ec7962:sAAYt1yQZqpvOnu6l8iUD/Y="
		@oldEncrypted = "2015.1:473a66fb5d816bc716f278ab819d88a5:+mTg7O9sgUND8pNQFG6h2GE="
		@badLabel = "xxxxxx:c7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q="
		@badKey = "2015.1:d7a39310056b694c:jQf+Uh5Den3JREtvc82GW5Q="
		@badCipherText = "2015.1:c7a39310056b694c:xQf+Uh5Den3JREtvc82GW5Q="
		@requires = requires:
			"settings-sharelatex":
				cipherLabel: "2016.1"
				cipherPasswords:
					"2016.1": "11111111111111111111111111111111111111"
					"2015.1": "22222222222222222222222222222222222222"
		@AccessTokenEncryptor = SandboxedModule.require modulePath, @requires

	describe "encrypt", ->
		it 'should encrypt the object', (done)->
			@AccessTokenEncryptor.encryptJson @testObject, (err, encrypted)->
				expect(err).to.be.null
				encrypted.should.match(/^2016.1:[0-9a-f]+:[a-zA-Z0-9=+\/]+$/)
				done()

		it 'should encrypt the object differently the next time', (done)->
			@AccessTokenEncryptor.encryptJson @testObject, (err, encrypted1)=>
				@AccessTokenEncryptor.encryptJson @testObject, (err, encrypted2)=>
					encrypted1.should.not.equal(encrypted2)
					done()

	describe "decrypt", ->
		it 'should decrypt the string to get the same object', (done)->
			@AccessTokenEncryptor.encryptJson @testObject, (err, encrypted) =>
				expect(err).to.be.null
				@AccessTokenEncryptor.decryptToJson encrypted, (err, decrypted) =>
					expect(err).to.be.null
					expect(decrypted).to.deep.equal @testObject
					done()

		it 'should decrypt an old string to get the same object', (done)->
			@AccessTokenEncryptor.decryptToJson @oldEncrypted, (err, decrypted)=>
				expect(err).to.be.null
				expect(decrypted).to.deep.equal @testObject
				done()

		it 'should return an error when decrypting an invalid label', (done)->
			@AccessTokenEncryptor.decryptToJson @badLabel, (err, decrypted)->
				expect(err).to.be.instanceof(Error)
				expect(decrypted).to.be.undefined
				done()

		it 'should return an error when decrypting an invalid key', (done)->
			@AccessTokenEncryptor.decryptToJson @badKey, (err, decrypted)->
				expect(err).to.be.instanceof(Error)
				expect(decrypted).to.be.undefined
				done()

		it 'should return an error when decrypting an invalid ciphertext',(done)->
			@AccessTokenEncryptor.decryptToJson	@badCipherText, (err, decrypted)->
				expect(err).to.be.instanceof(Error)
				expect(decrypted).to.be.undefined
				done()
