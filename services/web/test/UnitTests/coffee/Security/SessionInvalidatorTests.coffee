should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Security/SessionInvalidator"
expect = require("chai").expect

describe "SessionInvaildator", ->

	beforeEach ->
		@settings =
			redis:
				web:{}
		@rclient =
			del:sinon.stub()
			set:sinon.stub().callsArgWith(2)
			get:sinon.stub()
		@SessionInvaildator = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"redis-sharelatex": createClient:=> 
				return @rclient
		@emailAddress = "bob@smith"
		@sessionId = "sess:123456"
		@stubbedKey = "e_sess:7890"

	describe "_getEmailKey", ->

		it "should get the email key by hashing it", ->
			result = @SessionInvaildator._getEmailKey "bob@smith.com"
			result.should.equal "e_sess:6815b961bfb8f83dd4cecd357e55e62d"

	describe "tracksession", ->

		it "should save the session in redis", (done)->

			@SessionInvaildator._getEmailKey = sinon.stub().returns(@stubbedKey)
			@SessionInvaildator.tracksession @sessionId, @emailAddress, =>
				@rclient.set.calledWith(@stubbedKey).should.equal true
				done()


	describe "invalidateSession", (done)->

		beforeEach ->
			@SessionInvaildator._getEmailKey = sinon.stub().returns(@stubbedKey)
			@rclient.del.callsArgWith(1)

		it "get the session key and delete it", (done)->
			@rclient.get.callsArgWith 1, null, @sessionId
			@SessionInvaildator.invalidateSession @emailAddress, =>
				@rclient.del.calledWith(@sessionId).should.equal true
				@rclient.del.calledWith(@stubbedKey).should.equal true

				done()

