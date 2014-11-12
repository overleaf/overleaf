chai = require "chai"
chai.should()
expect = chai.expect
sinon = require("sinon")
SandboxedModule = require('sandboxed-module')
path = require "path"
modulePath = '../../../app/js/AuthorizationManager'

describe 'AuthorizationManager', ->
	beforeEach ->
		@client =
			params: {}
			get: (param, cb) -> cb null, @params[param]
		@AuthorizationManager = SandboxedModule.require modulePath, requires: {}

	describe "assertClientCanViewProject", ->
		it "should allow the readOnly privilegeLevel", (done) ->
			@client.params.privilege_level = "readOnly"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				expect(error).to.be.null
				done()
	
		it "should allow the readAndWrite privilegeLevel", (done) ->
			@client.params.privilege_level = "readAndWrite"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				expect(error).to.be.null
				done()
				
		it "should allow the owner privilegeLevel", (done) ->
			@client.params.privilege_level = "owner"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				expect(error).to.be.null
				done()
				
		it "should return an error with any other privilegeLevel", (done) ->
			@client.params.privilege_level = "unknown"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				error.message.should.equal "not authorized"
				done()