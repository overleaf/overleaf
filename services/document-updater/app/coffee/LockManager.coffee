metrics = require('./Metrics')
Settings = require('settings-sharelatex')
redis = require('redis')
redisConf = Settings.redis?.web or Settings.redis or {host: "localhost", port: 6379}
rclient = redis.createClient(redisConf.port, redisConf.host)
rclient.auth(redisConf.password)
keys = require('./RedisKeyBuilder')
logger = require "logger-sharelatex"

module.exports = LockManager =
	LOCK_TEST_INTERVAL: 50 # 50ms between each test of the lock
	MAX_LOCK_WAIT_TIME: 10000 # 10s maximum time to spend trying to get the lock

	tryLock : (doc_id, callback = (err, isFree)->)->
		tenSeconds = 10
		rclient.set keys.blockingKey(doc_id: doc_id), "locked", "EX", 10, "NX", (err, gotLock)->
			return callback(err) if err?
			if gotLock == "OK"
				metrics.inc "doc-not-blocking"
				callback err, true
			else
				metrics.inc "doc-blocking"
				logger.log doc_id: doc_id, redis_response: gotLock, "doc is locked"
				callback err, false

	getLock: (doc_id, callback = (error) ->) ->
		startTime = Date.now()
		do attempt = () ->
			if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
				return callback(new Error("Timeout"))

			LockManager.tryLock doc_id, (error, gotLock) ->
				return callback(error) if error?
				if gotLock
					callback(null)
				else
					setTimeout attempt, LockManager.LOCK_TEST_INTERVAL

	checkLock: (doc_id, callback = (err, isFree)->)->
		multi = rclient.multi()
		multi.exists keys.blockingKey(doc_id:doc_id)
		multi.exec (err, replys)->
			return callback(err) if err?
			exists = parseInt replys[0]
			if exists == 1
				metrics.inc "doc-blocking"
				callback err, false
			else
				metrics.inc "doc-not-blocking"
				callback err, true

	releaseLock: (doc_id, callback)->
		rclient.del keys.blockingKey(doc_id:doc_id), callback

	
