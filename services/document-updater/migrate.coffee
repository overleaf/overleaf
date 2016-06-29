RedisManager = require "./app/coffee/RedisManager"
UpdateManager = require "./app/coffee/UpdateManager"
LockManager = require "./app/coffee/LockManager"

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

doc_id = process.argv[2]
if !doc_id?
	console.log "Usage: coffee migrate.coffee DOC_ID"
	process.exit(1)

migrateDoc doc_id, (error) ->
	throw error if error?
	setTimeout () ->
		process.exit(0)
	, 200