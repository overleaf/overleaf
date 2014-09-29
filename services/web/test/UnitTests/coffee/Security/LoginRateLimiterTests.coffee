SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Security/LoginRateLimiter'

buildKey = (k)->
	return "LoginRateLimit:#{k}"

describe "LoginRateLimiter", ->
	beforeEach ->
		@email = "bob@bob.com"
		@incrStub = sinon.stub()
		@getStub = sinon.stub()
		@execStub = sinon.stub()
		@expireStub = sinon.stub()
		@delStub = sinon.stub().callsArgWith(1)

		@rclient = 
			auth:->
			del: @delStub
			multi: =>
				incr: @incrStub
				expire: @expireStub
				get: @getStub
				exec: @execStub

		@LoginRateLimiter = SandboxedModule.require modulePath, requires:
			'redis-sharelatex' : createClient: () => @rclient
	
	describe "processLoginRequest", ->

		it "should inc the counter for login requests in redis", (done)->
			@execStub.callsArgWith(0, "null", ["",""])
			@LoginRateLimiter.processLoginRequest @email, =>
				@incrStub.calledWith(buildKey(@email)).should.equal true
				done()

		it "should set a expire", (done)->
			@execStub.callsArgWith(0, "null", ["",""])
			@LoginRateLimiter.processLoginRequest @email, =>
				@expireStub.calledWith(buildKey(@email), 60 * 2).should.equal true
				done()

		it "should return true if the count is below 10", (done)->
			@execStub.callsArgWith(0, "null", ["", 9])
			@LoginRateLimiter.processLoginRequest @email, (err, isAllowed)=>
				isAllowed.should.equal true
				done()

		it "should return true if the count is 10", (done)->
			@execStub.callsArgWith(0, "null", ["", 10])
			@LoginRateLimiter.processLoginRequest @email, (err, isAllowed)=>
				isAllowed.should.equal true
				done()

		it "should return false if the count is above 10", (done)->
			@execStub.callsArgWith(0, "null", ["", 11])
			@LoginRateLimiter.processLoginRequest @email, (err, isAllowed)=>
				isAllowed.should.equal false
				done()


	describe "smoke test user", ->

		it "should have a higher limit", (done)->
			done()





	describe "recordSuccessfulLogin", ->

		it "should delete the user key", (done)->
			@LoginRateLimiter.recordSuccessfulLogin @email, =>
				@delStub.calledWith(buildKey(@email)).should.equal true
				done()