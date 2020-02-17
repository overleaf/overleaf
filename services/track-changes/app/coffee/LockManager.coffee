Settings = require "settings-sharelatex"
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.lock)
os = require "os"
crypto = require "crypto"
logger = require "logger-sharelatex"

HOST = os.hostname()
PID = process.pid
RND = crypto.randomBytes(4).toString('hex')
COUNT = 0

module.exports = LockManager =
	LOCK_TEST_INTERVAL: 50 # 50ms between each test of the lock
	MAX_LOCK_WAIT_TIME: 10000 # 10s maximum time to spend trying to get the lock
	LOCK_TTL: 300 # seconds (allow 5 minutes for any operation to complete)

	# Use a signed lock value as described in
	# http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
	# to prevent accidental unlocking by multiple processes
	randomLock : () ->
		time = Date.now()
		return "locked:host=#{HOST}:pid=#{PID}:random=#{RND}:time=#{time}:count=#{COUNT++}"

	unlockScript: 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

	tryLock : (key, callback = (err, gotLock) ->) ->
		lockValue = LockManager.randomLock()
		rclient.set key, lockValue, "EX", @LOCK_TTL, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				callback err, true, lockValue
			else
				callback err, false

	getLock: (key, callback = (error) ->) ->
		startTime = Date.now()
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				e = new Error("Timeout")
				e.key = key
				return callback(e)

			LockManager.tryLock key, (error, gotLock, lockValue) ->
				return callback(error) if error?
				if gotLock
					callback(null, lockValue)
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

	releaseLock: (key, lockValue, callback) ->
		rclient.eval LockManager.unlockScript, 1, key, lockValue, (err, result) ->
			if err?
				return callback(err)
			if result? and result isnt 1 # successful unlock should release exactly one key
				logger.error {key:key, lockValue:lockValue, redis_err:err, redis_result:result}, "unlocking error"
				return callback(new Error("tried to release timed out lock"))
			callback(err,result)

	runWithLock: (key, runner, callback = ( (error) -> )) ->
		LockManager.getLock key, (error, lockValue) ->
			return callback(error) if error?
			runner (error1) ->
				LockManager.releaseLock key, lockValue, (error2) ->
					error = error1 or error2
					return callback(error) if error?
					callback()

	healthCheck: (callback) ->
		action = (releaseLock) ->
			releaseLock()
		LockManager.runWithLock	"HistoryLock:HealthCheck:host=#{HOST}:pid=#{PID}:random=#{RND}", action, callback

	close: (callback) ->
		rclient.quit()
		rclient.once 'end', callback
