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
			"./RedisWrapper":
				client: ()->
					auth:->
			"settings-sharelatex":{redis:{}}
			"metrics-sharelatex":
				inc:->
				gauge:->

		@callback = sinon.stub()
		@key = "lock:web:lockName:project-id}"
		@namespace = 'lockName'

	describe "when the lock is not set", ->
		beforeEach (done) ->
			@LockManager._tryLock = sinon.stub().yields(null, true)
			@LockManager._getLock @key, @namespace, (args...) =>
				@callback(args...)
				done()

		it "should try to get the lock", ->
			@LockManager._tryLock
				.calledWith(@key, @namespace)
				.should.equal true

		it "should only need to try once", ->
			@LockManager._tryLock.callCount.should.equal 1

		it "should return the callback", ->
			@callback.calledWith(null).should.equal true

	describe "when the lock is initially set", ->
		beforeEach (done) ->
			startTime = Date.now()
			tries = 0
			@LockManager.LOCK_TEST_INTERVAL = 5
			@LockManager._tryLock = (key, namespace, callback = (error, isFree) ->) ->
				if (Date.now() - startTime < 20) or (tries < 2)
					tries = tries + 1
					callback null, false
				else
					callback null, true
			sinon.spy @LockManager, "_tryLock"

			@LockManager._getLock @key, @namespace, (args...) =>
				@callback(args...)
				done()

		it "should call tryLock multiple times until free", ->
			(@LockManager._tryLock.callCount > 1).should.equal true

		it "should return the callback", ->
			@callback.calledWith(null).should.equal true

	describe "when the lock times out", ->
		beforeEach (done) ->
			time = Date.now()
			@LockManager.MAX_LOCK_WAIT_TIME = 5
			@LockManager._tryLock = sinon.stub().yields(null, false)
			@LockManager._getLock @key, @namespace, (args...) =>
				@callback(args...)
				done()

		it "should return the callback with an error", ->
			@callback.calledWith(new Error("timeout")).should.equal true

	describe "when there are multiple requests for the same lock", ->
		beforeEach (done) ->
			locked = false
			@results = []
			@LockManager.LOCK_TEST_INTERVAL = 1
			@LockManager._tryLock = (key, namespace, callback = (error, gotLock, lockValue) ->) ->
				if locked
					callback null, false
				else
					locked = true # simulate getting the lock
					callback null, true
			# Start ten lock requests in order at 1ms 2ms 3ms...
			# with them randomly holding the lock for 0-100ms.
			# Use predefined values for the random delay to make the test
			# deterministic.
			randomDelays = [52, 45, 41, 84, 60, 81, 31, 46, 9, 43 ]
			startTime = 0
			for randomDelay, i in randomDelays
				do (randomDelay, i) =>
					startTime += 1
					setTimeout () =>
						# changing the next line to the old method of LockManager._getLockByPolling
						# should give results in a random order and cause the test to fail.
						@LockManager._getLock @key, @namespace, (args...) =>
							setTimeout () ->
								locked = false  # release the lock after a random amount of time
							, randomDelay
							@results.push i
							if @results.length is 10
								done()
					, startTime

		it "should process the requests in order", ->
			@results.should.deep.equal [0,1,2,3,4,5,6,7,8,9]
