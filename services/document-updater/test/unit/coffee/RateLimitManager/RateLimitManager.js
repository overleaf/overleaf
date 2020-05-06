sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/RateLimitManager.js"
SandboxedModule = require('sandboxed-module')

describe "RateLimitManager", ->
	beforeEach ->
		@RateLimitManager = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"settings-sharelatex": @settings = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
				gauge: sinon.stub()
		@callback = sinon.stub()
		@RateLimiter = new @RateLimitManager(1)

	describe "for a single task", ->
		beforeEach ->
			@task = sinon.stub()
			@RateLimiter.run @task, @callback

		it "should execute the task in the background", ->
			@task.called.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

		it "should finish with a worker count of one", ->
			# because it's in the background
			expect(@RateLimiter.ActiveWorkerCount).to.equal 1

	describe "for multiple tasks", ->
		beforeEach (done) ->
			@task = sinon.stub()
			@finalTask = sinon.stub()
			task = (cb) =>
				@task()
				setTimeout cb, 100
			finalTask = (cb) =>
				@finalTask()
				setTimeout cb, 100
			@RateLimiter.run task, @callback
			@RateLimiter.run task, @callback
			@RateLimiter.run task, @callback
			@RateLimiter.run finalTask, (err) =>
				@callback(err)
				done()

		it "should execute the first three tasks", ->
			@task.calledThrice.should.equal true

		it "should execute the final task", ->
			@finalTask.called.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

		it "should finish with worker count of zero", ->
			expect(@RateLimiter.ActiveWorkerCount).to.equal 0

	describe "for a mixture of long-running tasks", ->
		beforeEach (done) ->
			@task = sinon.stub()
			@finalTask = sinon.stub()
			finalTask = (cb) =>
				@finalTask()
				setTimeout cb, 100
			@RateLimiter.run @task, @callback
			@RateLimiter.run @task, @callback
			@RateLimiter.run @task, @callback
			@RateLimiter.run finalTask, (err) =>
				@callback(err)
				done()

		it "should execute the first three tasks", ->
			@task.calledThrice.should.equal true

		it "should execute the final task", ->
			@finalTask.called.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

		it "should finish with worker count of three", ->
			expect(@RateLimiter.ActiveWorkerCount).to.equal 3
