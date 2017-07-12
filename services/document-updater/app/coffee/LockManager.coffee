metrics = require('./Metrics')
Settings = require('settings-sharelatex')
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.lock)
keys = Settings.redis.lock.key_schema
logger = require "logger-sharelatex"
os = require "os"
crypto = require "crypto"

Profiler = require "./Profiler"

HOST = os.hostname()
PID = process.pid
RND = crypto.randomBytes(4).toString('hex')
COUNT = 0

MAX_REDIS_REQUEST_LENGTH = 5000 # 5 seconds

module.exports = LockManager =
	LOCK_TEST_INTERVAL: 50 # 50ms between each test of the lock
	MAX_TEST_INTERVAL: 1000 # back off to 1s between each test of the lock
	MAX_LOCK_WAIT_TIME: 10000 # 10s maximum time to spend trying to get the lock
	LOCK_TTL: 30 # seconds. Time until lock auto expires in redis.

	# Use a signed lock value as described in
	# http://redis.io/topics/distlock#correct-implementation-with-a-single-instance
	# to prevent accidental unlocking by multiple processes
	randomLock : () ->
		time = Date.now()
		return "locked:host=#{HOST}:pid=#{PID}:random=#{RND}:time=#{time}:count=#{COUNT++}"

	unlockScript: 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

	tryLock : (doc_id, callback = (err, isFree)->)->
		lockValue = LockManager.randomLock()
		key = keys.blockingKey(doc_id:doc_id)
		profile = new Profiler("tryLock", {doc_id, key, lockValue})
		rclient.set key, lockValue, "EX", @LOCK_TTL, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				metrics.inc "doc-not-blocking"
				timeTaken = profile.log("got lock").end()
				if timeTaken > MAX_REDIS_REQUEST_LENGTH
					# took too long, so try to free the lock
					LockManager.releaseLock doc_id, lockValue, (err, result) ->
						return callback(err) if err? # error freeing lock
						callback null, false # tell caller they didn't get the lock
				else
					callback null, true, lockValue
			else
				metrics.inc "doc-blocking"
				profile.log("doc is locked").end()
				callback null, false

	getLock: (doc_id, callback = (error, lockValue) ->) ->
		startTime = Date.now()
		testInterval = LockManager.LOCK_TEST_INTERVAL
		profile = new Profiler("getLock", {doc_id})
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				e = new Error("Timeout")
				e.doc_id = doc_id
				profile.log("timeout").end()
				return callback(e)

			LockManager.tryLock doc_id, (error, gotLock, lockValue) ->
				return callback(error) if error?
				profile.log("tryLock")
				if gotLock
					profile.end()
					callback(null, lockValue)
				else
					setTimeout attempt, testInterval
					# back off when the lock is taken to avoid overloading
					testInterval = Math.min(testInterval * 2, LockManager.MAX_TEST_INTERVAL)

	checkLock: (doc_id, callback = (err, isFree)->)->
		key = keys.blockingKey(doc_id:doc_id)
		rclient.exists key, (err, exists) ->
			return callback(err) if err?
			exists = parseInt exists
			if exists == 1
				metrics.inc "doc-blocking"
				callback null, false
			else
				metrics.inc "doc-not-blocking"
				callback null, true

	releaseLock: (doc_id, lockValue, callback)->
		key = keys.blockingKey(doc_id:doc_id)
		profile = new Profiler("releaseLock", {doc_id, key, lockValue})
		rclient.eval LockManager.unlockScript, 1, key, lockValue, (err, result) ->
			if err?
				return callback(err)
			else if result? and result isnt 1 # successful unlock should release exactly one key
				profile.log("unlockScript:expired-lock").end()
				logger.error {doc_id:doc_id, key:key, lockValue:lockValue, redis_err:err, redis_result:result}, "unlocking error"
				metrics.inc "unlock-error"
				return callback(new Error("tried to release timed out lock"))
			else
				profile.log("unlockScript:ok").end()
				callback(null,result)
