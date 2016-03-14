SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Security/RateLimiterMiddlewear'

describe "RateLimiterMiddlewear", ->
	beforeEach ->
		@RateLimiterMiddlewear = SandboxedModule.require modulePath, requires:
			'../../infrastructure/RateLimiter' : @RateLimiter = {}
			"logger-sharelatex": @logger = {warn: sinon.stub()}
		@req =
			params: {}
		@res =
			status: sinon.stub()
			write: sinon.stub()
			end: sinon.stub()
		@next = sinon.stub()
	
	describe "rateLimit", ->
		beforeEach ->
			@rateLimiter = @RateLimiterMiddlewear.rateLimit({
				endpointName: "test-endpoint"
				params: ["project_id", "doc_id"]
				timeInterval: 42
				maxRequests: 12
			})
			@req.params = {
				project_id: @project_id = "project-id"
				doc_id: @doc_id = "doc-id"
			}
			
		describe "when there is no session", ->
			beforeEach ->
				@RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
				@req.ip = @ip = "1.2.3.4"
				@rateLimiter(@req, @res, @next)

			it "should call the rate limiter backend with the ip address", ->
				@RateLimiter.addCount
					.calledWith({
						endpointName: "test-endpoint"
						timeInterval: 42
						throttle: 12
						subjectName: "#{@project_id}:#{@doc_id}:#{@ip}"
					})
					.should.equal true
					
			it "should pass on to next()", ->


		describe "when under the rate limit with logged in user", ->
			beforeEach ->
				@req.session =
					user : 
						_id: @user_id = "user-id"
				@RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
				@rateLimiter(@req, @res, @next)
				
			it "should call the rate limiter backend with the user_id", ->
				@RateLimiter.addCount
					.calledWith({
						endpointName: "test-endpoint"
						timeInterval: 42
						throttle: 12
						subjectName: "#{@project_id}:#{@doc_id}:#{@user_id}"
					})
					.should.equal true
					
			it "should pass on to next()", ->
				@next.called.should.equal true
				
		describe "when under the rate limit with anonymous user", ->
			beforeEach ->
				@req.ip = @ip = "1.2.3.4"
				@RateLimiter.addCount = sinon.stub().callsArgWith(1, null, true)
				@rateLimiter(@req, @res, @next)
				
			it "should call the rate limiter backend with the ip address", ->
				@RateLimiter.addCount
					.calledWith({
						endpointName: "test-endpoint"
						timeInterval: 42
						throttle: 12
						subjectName: "#{@project_id}:#{@doc_id}:#{@ip}"
					})
					.should.equal true
					
			it "should pass on to next()", ->
				@next.called.should.equal true
				
		describe "when over the rate limit", ->
			beforeEach ->
				@req.session  = 
					user : 
						_id: @user_id = "user-id"
				@RateLimiter.addCount = sinon.stub().callsArgWith(1, null, false)
				@rateLimiter(@req, @res, @next)
				
			it "should return a 429", ->
				@res.status.calledWith(429).should.equal true
				@res.end.called.should.equal true
				
			it "should not continue", ->
				@next.called.should.equal false
				
			it "should log a warning", ->
				@logger.warn
					.calledWith({
						endpointName: "test-endpoint"
						timeInterval: 42
						throttle: 12
						subjectName: "#{@project_id}:#{@doc_id}:#{@user_id}"
					}, "rate limit exceeded")
					.should.equal true
			