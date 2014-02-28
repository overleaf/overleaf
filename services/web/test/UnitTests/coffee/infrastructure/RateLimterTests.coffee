assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/infrastructure/RateLimiter.js"
SandboxedModule = require('sandboxed-module')

describe "FileStoreHandler", ->

	beforeEach ->
		@settings = apis:{filestore:{url:"http//filestore.sharelatex.test"}}
		@redbackInstance = 
			addCount: sinon.stub()

		@redback = 
			createRateLimit: sinon.stub().returns(@redbackInstance)

		@limiter = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex" : @logger = {log:sinon.stub(), err:sinon.stub()}
			"redback": createClient: => @redback

		@endpointName = "compiles"
		@subject = "some project id"
		@timeInterval = 20
		@throttleLimit = 5

		@details = 
			endpointName: @endpointName
			subjectName: @subject
			throttle: @throttleLimit
			timeInterval: @timeInterval


	describe "addCount", ->

		beforeEach ->
			@redbackInstance.addCount.callsArgWith(2, null, 10)

		it "should use correct namespace", (done)->
			@limiter.addCount @details, =>
				@redback.createRateLimit.calledWith(@endpointName).should.equal true
				done()

		it "should only call it once", (done)->
			@limiter.addCount @details, =>
				@redbackInstance.addCount.callCount.should.equal 1
				done()

		it  "should use the subjectName", (done)->
			@limiter.addCount @details, =>
				@redbackInstance.addCount.calledWith(@details.subjectName, @details.timeInterval).should.equal true
				done()

		it "should return true if the count is less than throttle", (done)-> 
			@details.throttle = 100
			@limiter.addCount @details, (err, canProcess)=>
				canProcess.should.equal true
				done()

		it "should return true if the count is less than throttle", (done)-> 
			@details.throttle = 1
			@limiter.addCount @details, (err, canProcess)=>
				canProcess.should.equal false
				done()

		it "should return false if the limit is matched", (done)-> 
			@details.throttle = 10
			@limiter.addCount @details, (err, canProcess)=>
				canProcess.should.equal false
				done()

