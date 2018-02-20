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
		# This error is defined here so we get a useful stacktrace
		slowExecutionError = new Error "slow execution during lock"

		timer = new metrics.Timer("lock.#{namespace}")
		key = "lock:web:#{namespace}:#{id}"
		LockManager._getLock key, namespace, (error) ->
			return callback(error) if error?

			# The lock can expire in redis but the process carry on. This setTimout call
			# is designed to log if this happens.
			countIfExceededLockTimeout = () ->
				metrics.inc "lock.#{namespace}.exceeded_lock_timeout"
				logger.log "exceeded lock timeout", { namespace, id, slowExecutionError }
			exceededLockTimeout = setTimeout countIfExceededLockTimeout, LockManager.REDIS_LOCK_EXPIRY * 1000

			runner (error1, values...) ->
				LockManager._releaseLock key, (error2) ->
					clearTimeout exceededLockTimeout

					timeTaken = new Date - timer.start
					if timeTaken > LockManager.SLOW_EXECUTION_THRESHOLD
						logger.log "slow execution during lock", { namespace, id, timeTaken, slowExecutionError }

					timer.done()
					error = error1 or error2
					return callback(error) if error?
					callback null, values...

	_tryLock : (key, namespace, callback = (err, isFree)->)->
		rclient.set key, "locked", "EX", LockManager.REDIS_LOCK_EXPIRY, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				metrics.inc "lock.#{namespace}.try.success"
				callback err, true
			else
				metrics.inc "lock.#{namespace}.try.failed"
				logger.log key: key, redis_response: gotLock, "lock is locked"
				callback err, false

	_getLock: (key, namespace, callback = (error) ->) ->
		startTime = Date.now()
		attempts = 0
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				metrics.inc "lock.#{namespace}.get.failed"
				return callback(new Error("Timeout"))

			attempts += 1
			LockManager._tryLock key, namespace, (error, gotLock) ->
				return callback(error) if error?
				if gotLock
					metrics.inc "lock.#{namespace}.get.success.tries", attempts
					callback(null)
				else
					setTimeout attempt, LockManager.LOCK_TEST_INTERVAL

	_releaseLock: (key, callback)->
		rclient.del key, callback
