assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/infrastructure/RateLimiter.js"
SandboxedModule = require('sandboxed-module')

describe "RateLimiter", ->

	beforeEach ->
		@settings = 
			redis:
				web:
					port:"1234"
					host:"somewhere"
					password: "password"
		@rclient =
			incr: sinon.stub()
			get: sinon.stub()
			expire: sinon.stub()
			exec: sinon.stub()
		@rclient.multi = sinon.stub().returns(@rclient)
		@RedisWrapper =
			client: sinon.stub().returns(@rclient)

		@limiter = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex" : @logger = {log:sinon.stub(), err:sinon.stub()}
			"./RedisWrapper": @RedisWrapper

		@endpointName = "compiles"
		@subject = "some-project-id"
		@timeInterval = 20
		@throttleLimit = 5

		@details = 
			endpointName: @endpointName
			subjectName: @subject
			throttle: @throttleLimit
			timeInterval: @timeInterval
		@key = "RateLimiter:#{@endpointName}:{#{@subject}}"

	for redisType, resultSet of {
		normal:[10, '10', 10],
		cluster:[[null,10], [null,'10'], [null,10]]
	}
		do (redisType, resultSet) ->

			describe "addCount with #{redisType} redis", ->

				beforeEach ->
					@results = resultSet
					@rclient.incr = sinon.stub()
					@rclient.get = sinon.stub()
					@rclient.expire = sinon.stub()
					@rclient.exec = sinon.stub().callsArgWith(0, null, @results)

				it "should use correct key", (done)->
					@limiter.addCount @details, =>
						@rclient.incr.calledWith(@key).should.equal true
						done()

				it "should only call it once", (done)->
					@limiter.addCount @details, =>
						@rclient.exec.callCount.should.equal 1
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
