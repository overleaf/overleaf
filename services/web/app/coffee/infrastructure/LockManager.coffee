metrics = require('metrics-sharelatex')
Settings = require('settings-sharelatex')
RedisWrapper = require("./RedisWrapper")
rclient = RedisWrapper.client("lock")
logger = require "logger-sharelatex"

module.exports = LockManager =
	LOCK_TEST_INTERVAL: 50 # 50ms between each test of the lock
	MAX_LOCK_WAIT_TIME: 10000 # 10s maximum time to spend trying to get the lock
	REDIS_LOCK_EXPIRY: 30 # seconds. Time until lock auto expires in redis
	SLOW_EXECUTION_THRESHOLD: 5000 # 5s, if execution takes longer than this then log

	runWithLock: (namespace, id, runner = ( (releaseLock = (error) ->) -> ), callback = ( (error) -> )) ->

		# The lock can expire in redis but the process carry on. This setTimout call
		# is designed to log if this happens.
		#
		# error is defined here so we get a useful stacktrace
		lockReleased = false
		slowExecutionError = new Error "slow execution during lock"
		countIfExceededLockTimeout = () ->
			if !lockReleased
				metrics.inc "lock.#{namespace}.exceeded_lock_timeout"
				logger.log "exceeded lock timeout", { namespace, id, slowExecutionError }

		setTimeout countIfExceededLockTimeout, LockManager.REDIS_LOCK_EXPIRY * 1000

		timer = new metrics.Timer("lock.#{namespace}")
		key = "lock:web:#{namespace}:#{id}"
		LockManager._getLock key, (error) ->
			return callback(error) if error?
			runner (error1, values...) ->
				LockManager._releaseLock key, (error2) ->
					lockReleased = true
					timeTaken = new Date - timer.start
					if timeTaken > LockManager.SLOW_EXECUTION_THRESHOLD
						logger.log "slow execution during lock", { namespace, id, timeTaken, slowExecutionError }

					timer.done()
					error = error1 or error2
					return callback(error) if error?
					callback null, values...

	_tryLock : (key, callback = (err, isFree)->)->
		rclient.set key, "locked", "EX", LockManager.REDIS_LOCK_EXPIRY, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				metrics.inc "lock-not-blocking"
				callback err, true
			else
				metrics.inc "lock-blocking"
				logger.log key: key, redis_response: gotLock, "lock is locked"
				callback err, false

	_getLock: (key, callback = (error) ->) ->
		startTime = Date.now()
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				return callback(new Error("Timeout"))

			LockManager._tryLock key, (error, gotLock) ->
				return callback(error) if error?
				if gotLock
					callback(null)
				else
					setTimeout attempt, LockManager.LOCK_TEST_INTERVAL

	_checkLock: (key, callback = (err, isFree)->)->
		multi = rclient.multi()
		multi.exists key
		multi.exec (err, replys)->
			return callback(err) if err?
			exists = parseInt replys[0]
			if exists == 1
				metrics.inc "lock-blocking"
				callback err, false
			else
				metrics.inc "lock-not-blocking"
				callback err, true

	_releaseLock: (key, callback)->
		rclient.del key, callback
