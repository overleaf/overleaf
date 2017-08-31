sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/LockManager.js"
SandboxedModule = require('sandboxed-module')

describe "LockManager", ->
	beforeEach ->
		@Settings = 		
			redis:
				lock:{}
		@LockManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex":
				createClient: () => @rclient =
					auth: sinon.stub()
			"settings-sharelatex": @Settings
			"logger-sharelatex": {error: ->}

		@key = "lock-key"
		@callback = sinon.stub()

	describe "checkLock", ->
		describe "when the lock is taken", ->
			beforeEach ->
				@rclient.exists = sinon.stub().callsArgWith(1, null, "1")
				@LockManager.checkLock @key, @callback

			it "should check the lock in redis", ->
				@rclient.exists
					.calledWith(@key)
					.should.equal true

			it "should return the callback with false", ->
				@callback.calledWith(null, false).should.equal true

		describe "when the lock is free", ->
			beforeEach ->
				@rclient.exists = sinon.stub().callsArgWith(1, null, "0")
				@LockManager.checkLock @key, @callback

			it "should return the callback with true", ->
				@callback.calledWith(null, true).should.equal true


	describe "tryLock", ->
		describe "when the lock is taken", ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(5, null, null)
				@LockManager.randomLock = sinon.stub().returns "locked-random-value"
				@LockManager.tryLock @key, @callback

			it "should check the lock in redis", ->
				@rclient.set
					.calledWith(@key, "locked-random-value", "EX", @LockManager.LOCK_TTL, "NX")
					.should.equal true

			it "should return the callback with false", ->
				@callback.calledWith(null, false).should.equal true

		describe "when the lock is free", ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(5, null, "OK")
				@LockManager.tryLock @key, @callback

			it "should return the callback with true", ->
				@callback.calledWith(null, true).should.equal true

	describe "deleteLock", ->
		beforeEach -> 
			beforeEach ->
				@rclient.del = sinon.stub().callsArg(1)
				@LockManager.deleteLock @key, @callback

			it "should delete the lock in redis", ->
				@rclient.del
					.calledWith(key)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "getLock", ->
		describe "when the lock is not taken", ->
			beforeEach (done) ->
				@LockManager.tryLock = sinon.stub().callsArgWith(1, null, true)
				@LockManager.getLock @key, (args...) =>
					@callback(args...)
					done()

			it "should try to get the lock", ->
				@LockManager.tryLock
					.calledWith(@key)
					.should.equal true

			it "should only need to try once", ->
				@LockManager.tryLock.callCount.should.equal 1

			it "should return the callback", ->
				@callback.calledWith(null).should.equal true

		describe "when the lock is initially set", ->
			beforeEach (done) ->
				startTime = Date.now()
				@LockManager.LOCK_TEST_INTERVAL = 5
				@LockManager.tryLock = (doc_id, callback = (error, isFree) ->) ->
					if Date.now() - startTime < 100
						callback null, false
					else
						callback null, true
				sinon.spy @LockManager, "tryLock"

				@LockManager.getLock @key, (args...) =>
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
				@LockManager.getLock @key, (args...) =>
					@callback(args...)
					done()

			it "should return the callback with an error", ->
				@callback.calledWith(sinon.match.instanceOf(Error)).should.equal true

	describe "runWithLock", ->
		describe "with successful run", ->
			beforeEach ->
				@runner = (releaseLock = (error) ->) ->
					releaseLock()
				sinon.spy @, "runner"
				@LockManager.getLock = sinon.stub().callsArg(1)
				@LockManager.releaseLock = sinon.stub().callsArg(2)
				@LockManager.runWithLock @key, @runner, @callback

			it "should get the lock", ->
				@LockManager.getLock
					.calledWith(@key)
					.should.equal true

			it "should run the passed function", ->
				@runner.called.should.equal true

			it "should release the lock", ->
				@LockManager.releaseLock
					.calledWith(@key)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the runner function returns an error", ->
			beforeEach ->
				@error = new Error("oops")
				@runner = (releaseLock = (error) ->) =>
					releaseLock(@error)
				sinon.spy @, "runner"
				@LockManager.getLock = sinon.stub().callsArg(1)
				@LockManager.releaseLock = sinon.stub().callsArg(2)
				@LockManager.runWithLock @key, @runner, @callback

			it "should release the lock", ->
				@LockManager.releaseLock
					.calledWith(@key)
					.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "releaseLock", ->
			describe "when the lock is current", ->
				beforeEach ->
					@rclient.eval = sinon.stub().yields(null, 1)
					@LockManager.releaseLock @key, @lockValue, @callback

				it 'should clear the data from redis', ->
					@rclient.eval.calledWith(@LockManager.unlockScript, 1, @key, @lockValue).should.equal true

				it 'should call the callback', ->
					@callback.called.should.equal true

			describe "when the lock has expired", ->
				beforeEach ->
					@rclient.eval = sinon.stub().yields(null, 0)
					@LockManager.releaseLock @key, @lockValue, @callback

				it 'should return an error if the lock has expired', ->
					@callback.calledWith(sinon.match.has('message', "tried to release timed out lock")).should.equal true

