should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Security/OneTimeTokenHandler"
expect = require("chai").expect

describe "OneTimeTokenHandler", ->

	beforeEach ->
		@value = "user id here"
		@stubbedToken = require("crypto").randomBytes(32)

		@settings = 
			redis:
				web:{}
		@redisMulti =
			set:sinon.stub()
			get:sinon.stub()
			del:sinon.stub()
			expire:sinon.stub()
			exec:sinon.stub()
		self = @
		@OneTimeTokenHandler = SandboxedModule.require modulePath, requires:
			"redis-sharelatex" :
				createClient: =>
					auth:->
					multi: -> return self.redisMulti

			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"crypto": randomBytes: () => @stubbedToken


	describe "getNewToken", ->

		it "should set a new token into redis with a ttl", (done)->
			@redisMulti.exec.callsArgWith(0) 
			@OneTimeTokenHandler.getNewToken @value, (err, token) =>
				@redisMulti.set.calledWith("password_token:#{@stubbedToken.toString("hex")}", @value).should.equal true
				@redisMulti.expire.calledWith("password_token:#{@stubbedToken.toString("hex")}", 60 * 60).should.equal true
				done()

		it "should return if there was an error", (done)->
			@redisMulti.exec.callsArgWith(0, "error")
			@OneTimeTokenHandler.getNewToken @value, (err, token)=>
				err.should.exist
				done()

		it "should allow the expiry time to be overridden", (done) ->
			@redisMulti.exec.callsArgWith(0) 
			@ttl = 42
			@OneTimeTokenHandler.getNewToken @value, {expiresIn: @ttl}, (err, token) =>
				@redisMulti.expire.calledWith("password_token:#{@stubbedToken.toString("hex")}", @ttl).should.equal true
				done()

	describe "getValueFromTokenAndExpire", ->

		it "should get and delete the token", (done)->
			@redisMulti.exec.callsArgWith(0, null, [@value]) 
			@OneTimeTokenHandler.getValueFromTokenAndExpire @stubbedToken, (err, value)=>
				value.should.equal @value
				@redisMulti.get.calledWith("password_token:#{@stubbedToken}").should.equal true
				@redisMulti.del.calledWith("password_token:#{@stubbedToken}").should.equal true
				done()



