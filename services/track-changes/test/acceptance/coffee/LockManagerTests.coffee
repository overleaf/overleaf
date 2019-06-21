sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"
LockManager = require "../../../app/js/LockManager"
rclient = require("redis").createClient(Settings.redis.history) # Only works locally for now
TrackChangesApp = require "./helpers/TrackChangesApp"

describe "Locking document", ->

	before (done)->
		TrackChangesApp.ensureRunning done
		return null
		
	describe "when the lock has expired in redis", ->
		before (done) ->
			LockManager.LOCK_TTL = 1 # second
			LockManager.runWithLock "doc123", (releaseA) =>
				# we create a lock A and allow it to expire in redis
				setTimeout () ->
					# now we create a new lock B and try to release A
					LockManager.runWithLock "doc123", (releaseB) =>
						releaseA()  # try to release lock A to see if it wipes out lock B
					, (error) ->
						# we never release lock B so nothing should happen here
				, 1500 # enough time to wait until the lock has expired
			, (error) ->
				# we get here after trying to release lock A
				done()
			return null

		it "the new lock should not be removed by the expired locker", (done) ->
			LockManager.checkLock "doc123", (err, isFree) ->
					expect(isFree).to.equal false
					done()
			return null
