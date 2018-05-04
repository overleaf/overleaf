metrics = require('metrics-sharelatex')
Settings = require('settings-sharelatex')
RedisWrapper = require("./RedisWrapper")
rclient = RedisWrapper.client("lock")
logger = require "logger-sharelatex"
os = require "os"
crypto = require "crypto"

HOST = os.hostname()
PID = process.pid
RND = crypto.randomBytes(4).toString('hex')
COUNT = 0

module.exports = LockManager =
	LOCK_TEST_INTERVAL: 50 # 50ms between each test of the lock
	MAX_LOCK_WAIT_TIME: 10000 # 10s maximum time to spend trying to get the lock
	REDIS_LOCK_EXPIRY: 30 # seconds. Time until lock auto expires in redis
	SLOW_EXECUTION_THRESHOLD: 5000 # 5s, if execution takes longer than this then log

	# Use a signed lock value as described in
	# http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
	# to prevent accidental unlocking by multiple processes
	randomLock : () ->
		time = Date.now()
		return "locked:host=#{HOST}:pid=#{PID}:random=#{RND}:time=#{time}:count=#{COUNT++}"

	unlockScript: 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end'

	runWithLock: (namespace, id, runner = ( (releaseLock = (error) ->) -> ), callback = ( (error) -> )) ->
		# This error is defined here so we get a useful stacktrace
		slowExecutionError = new Error "slow execution during lock"

		timer = new metrics.Timer("lock.#{namespace}")
		key = "lock:web:#{namespace}:#{id}"
		LockManager._getLock key, namespace, (error, lockValue) ->
			return callback(error) if error?

			# The lock can expire in redis but the process carry on. This setTimout call
			# is designed to log if this happens.
			countIfExceededLockTimeout = () ->
				metrics.inc "lock.#{namespace}.exceeded_lock_timeout"
				logger.log "exceeded lock timeout", { namespace, id, slowExecutionError }
			exceededLockTimeout = setTimeout countIfExceededLockTimeout, LockManager.REDIS_LOCK_EXPIRY * 1000

			runner (error1, values...) ->
				LockManager._releaseLock key, lockValue, (error2) ->
					clearTimeout exceededLockTimeout

					timeTaken = new Date - timer.start
					if timeTaken > LockManager.SLOW_EXECUTION_THRESHOLD
						logger.log "slow execution during lock", { namespace, id, timeTaken, slowExecutionError }

					timer.done()
					error = error1 or error2
					return callback(error) if error?
					callback null, values...

	_tryLock : (key, namespace, callback = (err, isFree, lockValue)->)->
		lockValue = LockManager.randomLock()
		rclient.set key, lockValue, "EX", LockManager.REDIS_LOCK_EXPIRY, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				metrics.inc "lock.#{namespace}.try.success"
				callback err, true, lockValue
			else
				metrics.inc "lock.#{namespace}.try.failed"
				logger.log key: key, redis_response: gotLock, "lock is locked"
				callback err, false

	_getLock: (key, namespace, callback = (error, lockValue) ->) ->
		startTime = Date.now()
		attempts = 0
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				metrics.inc "lock.#{namespace}.get.failed"
				return callback(new Error("Timeout"))

			attempts += 1
			LockManager._tryLock key, namespace, (error, gotLock, lockValue) ->
				return callback(error) if error?
				if gotLock
					metrics.gauge "lock.#{namespace}.get.success.tries", attempts
					callback(null, lockValue)
				else
					setTimeout attempt, LockManager.LOCK_TEST_INTERVAL

	_releaseLock: (key, lockValue, callback)->
		rclient.eval LockManager.unlockScript, 1, key, lockValue, (err, result) ->
			if err?
				return callback(err)
			else if result? and result isnt 1 # successful unlock should release exactly one key
				logger.error {key:key, lockValue:lockValue, redis_err:err, redis_result:result}, "unlocking error"
				metrics.inc "unlock-error"
				return callback(new Error("tried to release timed out lock"))
			else
				callback(null,result)
