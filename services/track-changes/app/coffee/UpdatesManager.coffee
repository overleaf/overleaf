MongoManager = require "./MongoManager"
RedisManager = require "./RedisManager"
UpdateCompressor = require "./UpdateCompressor"
LockManager = require "./LockManager"
WebApiManager = require "./WebApiManager"
logger = require "logger-sharelatex"
async = require "async"

module.exports = UpdatesManager =
	compressAndSaveRawUpdates: (project_id, doc_id, rawUpdates, callback = (error) ->) ->
		length = rawUpdates.length
		if length == 0
			return callback()

		MongoManager.popLastCompressedUpdate doc_id, (error, lastCompressedUpdate) ->
			return callback(error) if error?

			# Ensure that raw updates start where lastCompressedUpdate left off
			if lastCompressedUpdate?
				rawUpdates = rawUpdates.slice(0)
				while rawUpdates[0]? and rawUpdates[0].v <= lastCompressedUpdate.v
					rawUpdates.shift()

				if rawUpdates[0]? and rawUpdates[0].v != lastCompressedUpdate.v + 1
					error = new Error("Tried to apply raw op at version #{rawUpdates[0].v} to last compressed update with version #{lastCompressedUpdate.v}")
					logger.error err: error, doc_id: doc_id, project_id: project_id, "inconsistent doc versions"
					# Push the update back into Mongo - catching errors at this
					# point is useless, we're already bailing
					MongoManager.insertCompressedUpdates project_id, doc_id, [lastCompressedUpdate], () ->
						return callback error
					return

			compressedUpdates = UpdateCompressor.compressRawUpdates lastCompressedUpdate, rawUpdates
			MongoManager.insertCompressedUpdates project_id, doc_id, compressedUpdates, (error) ->
				return callback(error) if error?
				logger.log project_id: project_id, doc_id: doc_id, rawUpdatesLength: length, compressedUpdatesLength: compressedUpdates.length, "compressed doc updates"
				callback()

	REDIS_READ_BATCH_SIZE: 100
	processUncompressedUpdates: (project_id, doc_id, callback = (error) ->) ->
		RedisManager.getOldestRawUpdates doc_id, UpdatesManager.REDIS_READ_BATCH_SIZE, (error, rawUpdates) ->
			return callback(error) if error?
			length = rawUpdates.length
			UpdatesManager.compressAndSaveRawUpdates project_id, doc_id, rawUpdates, (error) ->
				return callback(error) if error?
				logger.log project_id: project_id, doc_id: doc_id, "compressed and saved doc updates"
				RedisManager.deleteOldestRawUpdates doc_id, length, (error) ->
					return callback(error) if error?
					if length == UpdatesManager.REDIS_READ_BATCH_SIZE
						# There might be more updates
						logger.log project_id: project_id, doc_id: doc_id, "continuing processing updates"
						setTimeout () ->
							UpdatesManager.processUncompressedUpdates project_id, doc_id, callback
						, 0
					else
						logger.log project_id: project_id, doc_id: doc_id, "all raw updates processed"
						callback()

	processUncompressedUpdatesWithLock: (project_id, doc_id, callback = (error) ->) ->
		LockManager.runWithLock(
			"HistoryLock:#{doc_id}",
			(releaseLock) ->
				UpdatesManager.processUncompressedUpdates project_id, doc_id, releaseLock
			callback
		)

	getUpdates: (project_id, doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.processUncompressedUpdatesWithLock project_id, doc_id, (error) ->
			return callback(error) if error?
			MongoManager.getUpdates doc_id, options, callback

	getUpdatesWithUserInfo: (project_id, doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.getUpdates project_id, doc_id, options, (error, updates) ->
			return callback(error) if error?
			UpdatesManager.fillUserInfo updates, (error, updates) ->
				return callback(error) if error?
				callback null, updates

	getSummarizedUpdates: (project_id, doc_id, options = {}, callback = (error, updates) ->) ->
		options.limit ||= 25
		summarizedUpdates = []
		to = options.to
		do fetchNextBatch = () ->
			UpdatesManager._extendBatchOfSummarizedUpdates project_id, doc_id, summarizedUpdates, to, options.limit, (error, updates, endOfDatabase) ->
				return callback(error) if error?
				if endOfDatabase or updates.length >= options.limit
					callback null, updates
				else
					to = updates[updates.length - 1].fromV - 1
					summarizedUpdates = updates
					fetchNextBatch()

	_extendBatchOfSummarizedUpdates: (
		project_id, 
		doc_id,
		existingSummarizedUpdates,
		to, desiredLength,
		callback = (error, summarizedUpdates, endOfDatabase) ->
	) ->
		UpdatesManager.getUpdatesWithUserInfo project_id, doc_id, { to: to, limit: 3 * desiredLength }, (error, updates) ->
			return callback(error) if error?
			if !updates? or updates.length == 0
				endOfDatabase = true
			else
				endOfDatabase = false
			summarizedUpdates = UpdatesManager._summarizeUpdates(
				updates, existingSummarizedUpdates
			)
			callback null,
				summarizedUpdates.slice(0, desiredLength),
				endOfDatabase

	fillUserInfo: (updates, callback = (error, updates) ->) ->
		users = {}
		for update in updates
			if UpdatesManager._validUserId(update.meta.user_id)
				users[update.meta.user_id] = true

		jobs = []
		for user_id, _ of users
			do (user_id) ->
				jobs.push (callback) ->
					WebApiManager.getUserInfo user_id, (error, userInfo) ->
						return callback(error) if error?
						users[user_id] = userInfo
						callback()

		async.series jobs, (error) ->
			return callback(error) if error?
			for update in updates
				user_id = update.meta.user_id
				delete update.meta.user_id
				if UpdatesManager._validUserId(user_id)
					update.meta.user = users[user_id]
			callback null, updates

	_validUserId: (user_id) ->
		if !user_id?
			return false
		else
			return !!user_id.match(/^[a-f0-9]{24}$/)


	TIME_BETWEEN_DISTINCT_UPDATES: fiveMinutes = 5 * 60 * 1000
	_summarizeUpdates: (updates, existingSummarizedUpdates = []) ->
		summarizedUpdates = existingSummarizedUpdates.slice()
		for update in updates
			earliestUpdate = summarizedUpdates[summarizedUpdates.length - 1]
			if earliestUpdate and earliestUpdate.meta.start_ts - update.meta.end_ts < @TIME_BETWEEN_DISTINCT_UPDATES
				if update.meta.user?
					userExists = false
					for user in earliestUpdate.meta.users
						if user.id == update.meta.user.id
							userExists = true
							break
					if !userExists
						earliestUpdate.meta.users.push update.meta.user
				earliestUpdate.meta.start_ts = Math.min(earliestUpdate.meta.start_ts, update.meta.start_ts)
				earliestUpdate.meta.end_ts   = Math.max(earliestUpdate.meta.end_ts, update.meta.end_ts)
				earliestUpdate.fromV = update.v
			else
				newUpdate =
					meta:
						users: []
						start_ts: update.meta.start_ts
						end_ts: update.meta.end_ts
					fromV: update.v
					toV: update.v

				if update.meta.user?
					newUpdate.meta.users.push update.meta.user

				summarizedUpdates.push newUpdate

		return summarizedUpdates

