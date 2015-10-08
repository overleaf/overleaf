Settings = require "settings-sharelatex"
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)

module.exports = LockManager =
	LOCK_TEST_INTERVAL: 50 # 50ms between each test of the lock
	MAX_LOCK_WAIT_TIME: 10000 # 10s maximum time to spend trying to get the lock
	LOCK_TTL: 300 # seconds (allow 5 minutes for any operation to complete)

	tryLock : (key, callback = (err, gotLock) ->) ->
		rclient.set key, "locked", "EX", @LOCK_TTL, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				callback err, true
			else
				callback err, false

	getLock: (key, callback = (error) ->) ->
		startTime = Date.now()
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				return callback(new Error("Timeout"))

			LockManager.tryLock key, (error, gotLock) ->
				return callback(error) if error?
				if gotLock
					callback(null)
				else
					setTimeout attempt, LockManager.LOCK_TEST_INTERVAL

	checkLock: (key, callback = (err, isFree) ->) ->
		rclient.exists key, (err, exists) ->
			return callback(err) if err?
			exists = parseInt exists
			if exists == 1
				callback err, false
			else
				callback err, true

	releaseLock: (key, callback) ->
		rclient.del key, callback

	runWithLock: (key, runner = ( (releaseLock = (error) ->) -> ), callback = ( (error) -> )) ->
		LockManager.getLock key, (error) ->
			return callback(error) if error?
			runner (error1) ->
				LockManager.releaseLock key, (error2) ->
					error = error1 or error2
					return callback(error) if error?
					callback()

	
