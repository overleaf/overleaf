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
			"./Profiler": class Profiler
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

