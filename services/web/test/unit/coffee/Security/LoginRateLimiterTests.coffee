SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
expect = require('chai').expect
modulePath = require('path').join __dirname, '../../../../app/js/Features/Security/LoginRateLimiter'


describe "LoginRateLimiter", ->

	beforeEach ->
		@email = "bob@bob.com"
		@RateLimiter =
			clearRateLimit: sinon.stub()
			addCount: sinon.stub()

		@LoginRateLimiter = SandboxedModule.require modulePath, requires:
			'../../infrastructure/RateLimiter': @RateLimiter

	describe "processLoginRequest", ->

		beforeEach ->
			@RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)

		it 'should call RateLimiter.addCount', (done) ->
			@LoginRateLimiter.processLoginRequest @email, (err, allow) =>
				@RateLimiter.addCount.callCount.should.equal 1
				expect(@RateLimiter.addCount.lastCall.args[0].endpointName).to.equal 'login'
				expect(@RateLimiter.addCount.lastCall.args[0].subjectName).to.equal @email
				done()

		describe 'when login is allowed', ->

			beforeEach ->
				@RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)

			it 'should call pass allow=true', (done) ->
				@LoginRateLimiter.processLoginRequest @email, (err, allow) =>
					expect(err).to.equal null
					expect(allow).to.equal true
					done()

		describe 'when login is blocked', ->

			beforeEach ->
				@RateLimiter.addCount = sinon.stub().callsArgWith(1, null, false)

			it 'should call pass allow=false', (done) ->
				@LoginRateLimiter.processLoginRequest @email, (err, allow) =>
					expect(err).to.equal null
					expect(allow).to.equal false
					done()

		describe 'when addCount produces an error', ->

			beforeEach ->
				@RateLimiter.addCount = sinon.stub().callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@LoginRateLimiter.processLoginRequest @email, (err, allow) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()


	describe "recordSuccessfulLogin", ->

		beforeEach ->
			@RateLimiter.clearRateLimit = sinon.stub().callsArgWith 2, null

		it "should call clearRateLimit", (done)->
			@LoginRateLimiter.recordSuccessfulLogin @email, =>
				@RateLimiter.clearRateLimit.callCount.should.equal 1
				@RateLimiter.clearRateLimit.calledWith('login', @email).should.equal true
				done()
