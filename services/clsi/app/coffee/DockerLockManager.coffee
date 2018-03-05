logger = require "logger-sharelatex"

LockState = {} # locks for docker container operations, by container name

module.exports = LockManager =

	MAX_LOCK_HOLD_TIME: 15000  # how long we can keep a lock
	MAX_LOCK_WAIT_TIME: 10000  # how long we wait for a lock
	LOCK_TEST_INTERVAL: 1000   # retry time

	tryLock: (key, callback = (err, gotLock) ->) ->
		existingLock = LockState[key]
		if existingLock? # the lock is already taken, check how old it is
			lockAge = Date.now() - existingLock.created
			if lockAge < LockManager.MAX_LOCK_HOLD_TIME
				return callback(null, false) # we didn't get the lock, bail out
			else
				logger.error {key: key, lock: existingLock, age:lockAge}, "taking old lock by force"
		# take the lock
		LockState[key] = lockValue = {created: Date.now()}
		callback(null, true, lockValue)

	getLock: (key, callback = (error, lockValue) ->) ->
		startTime = Date.now()
		do attempt = () ->
			LockManager.tryLock key, (error, gotLock, lockValue) ->
				return callback(error) if error?
				if gotLock
					callback(null, lockValue)
				else if Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME
					e = new Error("Lock timeout")
					e.key = key
					return callback(e)
				else
					setTimeout attempt, LockManager.LOCK_TEST_INTERVAL

	releaseLock: (key, lockValue, callback = (error) ->) ->
		existingLock = LockState[key]
		if existingLock is lockValue # lockValue is an object, so we can test by reference
			delete LockState[key] # our lock, so we can free it
			callback()
		else if existingLock? # lock exists but doesn't match ours
			logger.error {key:key, lock: existingLock}, "tried to release lock taken by force"
			callback()
		else
			logger.error {key:key, lock: existingLock}, "tried to release lock that has gone"
			callback()

	runWithLock: (key, runner = ( (releaseLock = (error) ->) -> ), callback = ( (error) -> )) ->
		LockManager.getLock key, (error, lockValue) ->
			return callback(error) if error?
			runner (error1, args...) ->
				LockManager.releaseLock key, lockValue, (error2) ->
					error = error1 or error2
					return callback(error) if error?
					callback(null, args...)
