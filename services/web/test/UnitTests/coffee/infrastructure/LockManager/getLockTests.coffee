sinon = require('sinon')
chai = require('chai')
should = chai.should()
path = require('path')
modulePath = path.join __dirname, '../../../../../app/js/infrastructure/LockManager.js'
SandboxedModule = require('sandboxed-module')

describe 'LockManager - getting the lock', ->
	beforeEach ->
		@LockManager = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": log:->
			"redis-sharelatex":
				createClient : () =>
					auth:->
		@callback = sinon.stub()
		@doc_id = "doc-id-123"
	
	describe "when the lock is not set", ->
		beforeEach (done) ->
			@LockManager.tryLock = sinon.stub().callsArgWith(1, null, true)
			@LockManager.getLock @doc_id, (args...) =>
				@callback(args...)
				done()

		it "should try to get the lock", ->
			@LockManager.tryLock
				.calledWith(@doc_id)
				.should.equal true

		it "should only need to try once", ->
			@LockManager.tryLock.callCount.should.equal 1

		it "should return the callback", ->
			@callback.calledWith(null).should.equal true

	describe "when the lock is initially set", ->
		beforeEach (done) ->
			startTime = Date.now()
			tries = 0
			@LockManager.LOCK_TEST_INTERVAL = 5
			@LockManager.tryLock = (doc_id, callback = (error, isFree) ->) ->
				if (Date.now() - startTime < 20) or (tries < 2)
					tries = tries + 1
					callback null, false
				else
					callback null, true
			sinon.spy @LockManager, "tryLock"

			@LockManager.getLock @doc_id, (args...) =>
				@callback(args...)
				done()

		it "should call tryLock multiple times until free", ->
			(@LockManager.tryLock.callCount > 1).should.equal true

		it "should return the callback", ->
			@callback.calledWith(null).should.equal true

	describe "when the lock times out", ->
		beforeEach (done) ->
			time = Date.now()
			@LockManager.MAX_LOCK_WAIT_TIME = 5
			@LockManager.tryLock = sinon.stub().callsArgWith(1, null, false)
			@LockManager.getLock @doc_id, (args...) =>
				@callback(args...)
				done()

		it "should return the callback with an error", ->
			@callback.calledWith(new Error("timeout")).should.equal true
		


