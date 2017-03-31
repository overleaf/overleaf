metrics = require('./Metrics')
Settings = require('settings-sharelatex')
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)
logger = require "logger-sharelatex"
os = require "os"
crypto = require "crypto"

HOST = os.hostname()
PID = process.pid
RND = crypto.randomBytes(4).toString('hex')
COUNT = 0

keys =
	blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"

module.exports = LockManager =
	LOCK_TEST_INTERVAL: 50 # 50ms between each test of the lock
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
		rclient.set key, lockValue, "EX", @LOCK_TTL, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				metrics.inc "doc-not-blocking"
				callback err, true, lockValue
			else
				metrics.inc "doc-blocking"
				logger.log {doc_id}, "doc is locked"
				callback err, false

	getLock: (doc_id, callback = (error, lockValue) ->) ->
		startTime = Date.now()
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				e = new Error("Timeout")
				e.doc_id = doc_id
				return callback(e)

			LockManager.tryLock doc_id, (error, gotLock, lockValue) ->
				return callback(error) if error?
				if gotLock
					callback(null, lockValue)
				else
					setTimeout attempt, LockManager.LOCK_TEST_INTERVAL

	checkLock: (doc_id, callback = (err, isFree)->)->
		key = keys.blockingKey(doc_id:doc_id)
		rclient.exists key, (err, exists) ->
			return callback(err) if err?
			exists = parseInt exists
			if exists == 1
				metrics.inc "doc-blocking"
				callback err, false
			else
				metrics.inc "doc-not-blocking"
				callback err, true

	releaseLock: (doc_id, lockValue, callback)->
		key = keys.blockingKey(doc_id:doc_id)
		rclient.eval LockManager.unlockScript, 1, key, lockValue, (err, result) ->
			if err?
				return callback(err)
			if result? and result isnt 1 # successful unlock should release exactly one key
				logger.error {doc_id:doc_id, lockValue:lockValue, redis_err:err, redis_result:result}, "unlocking error"
				return callback(new Error("tried to release timed out lock"))
			callback(err,result)
