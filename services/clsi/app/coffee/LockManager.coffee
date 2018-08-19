Settings = require('settings-sharelatex')
logger = require "logger-sharelatex"
Lockfile = require('lockfile') # from https://github.com/npm/lockfile
Errors = require "./Errors"
fs = require("fs")
Path = require("path")
module.exports = LockManager =
	LOCK_TEST_INTERVAL: 1000 # 50ms between each test of the lock
	MAX_LOCK_WAIT_TIME: 15000 # 10s maximum time to spend trying to get the lock
	LOCK_STALE: 5*60*1000 # 5 mins time until lock auto expires

	runWithLock: (path, runner = ((releaseLock = (error) ->) ->), callback = ((error) ->)) ->
		lockOpts =
			wait: @MAX_LOCK_WAIT_TIME
			pollPeriod: @LOCK_TEST_INTERVAL
			stale: @LOCK_STALE
		Lockfile.lock path, lockOpts, (error) ->
			return callback new Errors.AlreadyCompilingError("compile in progress")	if error?.code is 'EEXIST'
			if error?
				logger.err error:error, path:path, statLock:fs.lstatSync(path), statDir: fs.lstatSync(path.dirname(path)), "unable to get lock"
				return callback(error) 
			runner (error1, args...) ->
				Lockfile.unlock path, (error2) ->
					error = error1 or error2
					return callback(error) if error?
					callback(null, args...)
