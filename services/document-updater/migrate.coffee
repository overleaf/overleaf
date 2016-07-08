RedisManager = require "./app/coffee/RedisManager"
UpdateManager = require "./app/coffee/UpdateManager"
LockManager = require "./app/coffee/LockManager"

async = require "async"

handleErrorInsideLock = (doc_id, lockValue, original_error, callback = (error) ->) ->
	LockManager.releaseLock doc_id, lockValue, (lock_error) ->
		callback(original_error)

migrateDoc = (doc_id, callback = (error) ->) ->
	LockManager.getLock doc_id, (error, lockValue) ->
		return callback(error) if error?
		RedisManager.getAndSetDoc doc_id, (error, project_id) ->
			return handleErrorInsideLock(doc_id, lockValue, error, callback) if error?
			RedisManager.getAndSetProject project_id, (error) ->
				return handleErrorInsideLock(doc_id, lockValue, error, callback) if error?
				LockManager.releaseLock doc_id, lockValue, (error) ->
					return callback(error) if error?
					UpdateManager.continueProcessingUpdatesWithLock project_id, doc_id, callback

doc_ids = process.argv.slice(2)
if doc_ids.length == 0
	console.log "Usage: coffee migrate.coffee DOC_ID [DOC_ID ...]"
	process.exit(1)

jobs = []
for doc_id in doc_ids
	do (doc_id) ->
		jobs.push (cb) ->
			console.log "MIGRATING #{doc_id}"
			migrateDoc doc_id, cb

async.series jobs, (error) ->
	throw error if error?
	process.exit(0)
