sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/LockManager.js"
SandboxedModule = require('sandboxed-module')

describe 'LockManager - trying the lock', ->
	beforeEach ->
		@LockManager = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": log:->
			"redis-sharelatex":
				createClient : () =>
					auth:->
					set: @set = sinon.stub()
			"./Metrics": {inc: () ->}
			"settings-sharelatex": {
				redis:
					lock:
						key_schema:
							blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
			}
			"./Profiler": @Profiler = class Profiler
				log: sinon.stub().returns { end: sinon.stub() }
				end: sinon.stub()

		@callback = sinon.stub()
		@doc_id = "doc-id-123"
	
	describe "when the lock is not set", ->
		beforeEach ->
			@lockValue = "mock-lock-value"
			@LockManager.randomLock = sinon.stub().returns @lockValue
			@set.callsArgWith(5, null, "OK")
			@LockManager.tryLock @doc_id, @callback

		it "should set the lock key with an expiry if it is not set", ->
			@set.calledWith("Blocking:#{@doc_id}", @lockValue, "EX", 30, "NX")
				.should.equal true

		it "should return the callback with true and the lock value", ->
			@callback.calledWith(null, true, @lockValue).should.equal true

	describe "when the lock is already set", ->
		beforeEach ->
			@set.callsArgWith(5, null, null)
			@LockManager.tryLock @doc_id, @callback

		it "should return the callback with false", ->
			@callback.calledWith(null, false).should.equal true

	describe "when it takes a long time for redis to set the lock", ->
		beforeEach ->
			@Profiler.prototype.end = () -> 7000 # take a long time
			@Profiler.prototype.log = sinon.stub().returns { end: @Profiler.prototype.end }
			@lockValue = "mock-lock-value"
			@LockManager.randomLock = sinon.stub().returns @lockValue
			@LockManager.releaseLock = sinon.stub().callsArgWith(2,null)
			@set.callsArgWith(5, null, "OK")

		describe "in all cases", ->
			beforeEach ->
				@LockManager.tryLock @doc_id, @callback

			it "should set the lock key with an expiry if it is not set", ->
				@set.calledWith("Blocking:#{@doc_id}", @lockValue, "EX", 30, "NX")
					.should.equal true

			it "should try to release the lock", ->
				@LockManager.releaseLock.calledWith(@doc_id, @lockValue).should.equal true

		describe "if the lock is released successfully", ->
			beforeEach ->
				@LockManager.releaseLock = sinon.stub().callsArgWith(2,null)
				@LockManager.tryLock @doc_id, @callback

			it "should return the callback with false", ->
				@callback.calledWith(null, false).should.equal true

		describe "if the lock has already timed out", ->
			beforeEach ->
				@LockManager.releaseLock = sinon.stub().callsArgWith(2, new Error("tried to release timed out lock"))
				@LockManager.tryLock @doc_id, @callback

			it "should return the callback with an error", ->
				e = new Error("tried to release timed out lock")
				@callback.calledWith(e).should.equal true
