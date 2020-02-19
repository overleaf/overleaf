SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
require "coffee-script"
modulePath = require('path').join __dirname, '../../../app/coffee/DockerLockManager'

describe "LockManager", ->
	beforeEach ->
		@LockManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @Settings =
				clsi: docker: {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }

	describe "runWithLock", ->
		describe "with a single lock", ->
			beforeEach (done) ->
				@callback  = sinon.stub()
				@LockManager.runWithLock "lock-one", (releaseLock) ->
					setTimeout () ->
						releaseLock(null, "hello", "world")
					, 100
				, (err, args...) =>
					@callback(err,args...)
					done()

			it "should call the callback", ->
				@callback.calledWith(null,"hello","world").should.equal true

		describe "with two locks", ->
			beforeEach (done) ->
				@callback1 = sinon.stub()
				@callback2 = sinon.stub()
				@LockManager.runWithLock "lock-one", (releaseLock) ->
					setTimeout () ->
						releaseLock(null, "hello", "world","one")
					, 100
				, (err, args...) =>
					@callback1(err,args...)
				@LockManager.runWithLock "lock-two", (releaseLock) ->
					setTimeout () ->
						releaseLock(null, "hello", "world","two")
					, 200
				, (err, args...) =>
					@callback2(err,args...)
					done()

			it "should call the first callback", ->
				@callback1.calledWith(null,"hello","world","one").should.equal true

			it "should call the second callback", ->
				@callback2.calledWith(null,"hello","world","two").should.equal true

		describe "with lock contention", ->
			describe "where the first lock is released quickly", ->
				beforeEach (done) ->
					@LockManager.MAX_LOCK_WAIT_TIME = 1000
					@LockManager.LOCK_TEST_INTERVAL = 100
					@callback1 = sinon.stub()
					@callback2 = sinon.stub()
					@LockManager.runWithLock "lock", (releaseLock) ->
						setTimeout () ->
							releaseLock(null, "hello", "world","one")
						, 100
					, (err, args...) =>
						@callback1(err,args...)
					@LockManager.runWithLock "lock", (releaseLock) ->
						setTimeout () ->
							releaseLock(null, "hello", "world","two")
						, 200
					, (err, args...) =>
						@callback2(err,args...)
						done()

				it "should call the first callback", ->
					@callback1.calledWith(null,"hello","world","one").should.equal true

				it "should call the second callback", ->
					@callback2.calledWith(null,"hello","world","two").should.equal true

			describe "where the first lock is held longer than the waiting time", ->
				beforeEach (done) ->
					@LockManager.MAX_LOCK_HOLD_TIME = 10000
					@LockManager.MAX_LOCK_WAIT_TIME = 1000
					@LockManager.LOCK_TEST_INTERVAL = 100
					@callback1 = sinon.stub()
					@callback2 = sinon.stub()
					doneOne = doneTwo = false
					finish = (key) ->
						doneOne = true if key is 1
						doneTwo = true if key is 2
						done() if doneOne and doneTwo
					@LockManager.runWithLock "lock", (releaseLock) ->
						setTimeout () ->
							releaseLock(null, "hello", "world","one")
						, 1100
					, (err, args...) =>
						@callback1(err,args...)
						finish(1)
					@LockManager.runWithLock "lock", (releaseLock) ->
						setTimeout () ->
							releaseLock(null, "hello", "world","two")
						, 100
					, (err, args...) =>
						@callback2(err,args...)
						finish(2)

				it "should call the first callback", ->
					@callback1.calledWith(null,"hello","world","one").should.equal true

				it "should call the second callback with an error", ->
					error = sinon.match.instanceOf Error
					@callback2.calledWith(error).should.equal true

			describe "where the first lock is held longer than the max holding time", ->
				beforeEach (done) ->
					@LockManager.MAX_LOCK_HOLD_TIME = 1000
					@LockManager.MAX_LOCK_WAIT_TIME = 2000
					@LockManager.LOCK_TEST_INTERVAL = 100
					@callback1 = sinon.stub()
					@callback2 = sinon.stub()
					doneOne = doneTwo = false
					finish = (key) ->
						doneOne = true if key is 1
						doneTwo = true if key is 2
						done() if doneOne and doneTwo
					@LockManager.runWithLock "lock", (releaseLock) ->
						setTimeout () ->
							releaseLock(null, "hello", "world","one")
						, 1500
					, (err, args...) =>
						@callback1(err,args...)
						finish(1)
					@LockManager.runWithLock "lock", (releaseLock) ->
						setTimeout () ->
							releaseLock(null, "hello", "world","two")
						, 100
					, (err, args...) =>
						@callback2(err,args...)
						finish(2)

				it "should call the first callback", ->
					@callback1.calledWith(null,"hello","world","one").should.equal true

				it "should call the second callback", ->
					@callback2.calledWith(null,"hello","world","two").should.equal true
