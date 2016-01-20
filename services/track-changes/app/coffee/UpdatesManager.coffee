MongoManager = require "./MongoManager"
PackManager = require "./PackManager"
RedisManager = require "./RedisManager"
UpdateCompressor = require "./UpdateCompressor"
LockManager = require "./LockManager"
WebApiManager = require "./WebApiManager"
UpdateTrimmer = require "./UpdateTrimmer"
logger = require "logger-sharelatex"
async = require "async"
DocArchiveManager = require "./DocArchiveManager"
_ = require "underscore"
Settings = require "settings-sharelatex"

module.exports = UpdatesManager =
	compressAndSaveRawUpdates: (project_id, doc_id, rawUpdates, temporary, callback = (error) ->) ->
		length = rawUpdates.length
		if length == 0
			return callback()

		MongoManager.peekLastCompressedUpdate doc_id, (error, lastCompressedUpdate, lastVersion) ->
			# lastCompressedUpdate is the most recent update in Mongo, and
			# lastVersion is its sharejs version number.
			#
			# The peekLastCompressedUpdate method may pass the update back
			# as 'null' (for example if the previous compressed update has
			# been archived).  In this case it can still pass back the
			# lastVersion from the update to allow us to check consistency.
			return callback(error) if error?

			# Ensure that raw updates start where lastVersion left off
			if lastVersion?
				rawUpdates = rawUpdates.slice(0)
				while rawUpdates[0]? and rawUpdates[0].v <= lastVersion
					rawUpdates.shift()

				if rawUpdates[0]? and rawUpdates[0].v != lastVersion + 1
					ts = lastCompressedUpdate?.meta?.end_ts
					last_timestamp = if ts? then new Date(ts) else 'unknown time'
					error = new Error("Tried to apply raw op at version #{rawUpdates[0].v} to last compressed update with version #{lastVersion} from #{last_timestamp}")
					logger.error err: error, doc_id: doc_id, project_id: project_id, prev_end_ts: ts, "inconsistent doc versions"
					if Settings.trackchanges?.continueOnError and rawUpdates[0].v > lastVersion + 1
						# we have lost some ops - continue to write into the database, we can't recover at this point
						lastCompressedUpdate = null
					else
						return callback error

			if rawUpdates.length == 0
				return callback()

			if temporary and (not lastCompressedUpdate? or lastCompressedUpdate.pack?) # handle pack append as a special case
				UpdatesManager._updatePack project_id, doc_id, rawUpdates, temporary, lastCompressedUpdate, lastVersion, callback
			else #use the existing op code
				UpdatesManager._updateOp project_id, doc_id, rawUpdates, temporary, lastCompressedUpdate, lastVersion, callback

	_updatePack: (project_id, doc_id, rawUpdates, temporary, lastCompressedUpdate, lastVersion, callback) ->
		compressedUpdates = UpdateCompressor.compressRawUpdates null, rawUpdates
		PackManager.insertCompressedUpdates project_id, doc_id, lastCompressedUpdate, compressedUpdates, temporary, (error, result) ->
			return callback(error) if error?
			logger.log {project_id, doc_id, orig_v: lastCompressedUpdate?.v, new_v: result.v}, "inserted updates into pack"	if result?
			callback()

	_updateOp: (project_id, doc_id, rawUpdates, temporary, lastCompressedUpdate, lastVersion, callback) ->
		compressedUpdates = UpdateCompressor.compressRawUpdates lastCompressedUpdate, rawUpdates

		if not lastCompressedUpdate?
			# no existing update, insert everything
			updateToModify = null
			updatesToInsert = compressedUpdates
		else
			# there are existing updates, see what happens when we
			# compress them together with the new ones
			[firstUpdate, additionalUpdates...] = compressedUpdates

			if firstUpdate.v == lastCompressedUpdate.v and _.isEqual(firstUpdate, lastCompressedUpdate)
				# first update version hasn't changed, skip it and insert remaining updates
				# this is an optimisation, we could update the existing op with itself
				updateToModify = null
				updatesToInsert = additionalUpdates
			else
				# first update version did changed, modify it and insert remaining updates
				updateToModify = firstUpdate
				updatesToInsert = additionalUpdates

		MongoManager.modifyCompressedUpdate lastCompressedUpdate, updateToModify, (error, result) ->
			return callback(error) if error?
			logger.log {project_id, doc_id, orig_v: lastCompressedUpdate.v, new_v: result.v}, "applied update in-place"	if result?
			MongoManager.insertCompressedUpdates project_id, doc_id, updatesToInsert, temporary,(error) ->
				return callback(error) if error?
				logger.log project_id: project_id, doc_id: doc_id, rawUpdatesLength: rawUpdates.length, compressedUpdatesLength: compressedUpdates.length, "compressed doc updates"
				callback()

	REDIS_READ_BATCH_SIZE: 100
	processUncompressedUpdates: (project_id, doc_id, callback = (error) ->) ->
		UpdateTrimmer.shouldTrimUpdates project_id, (error, temporary) ->
			return callback(error) if error?
			MongoManager.backportProjectId project_id, doc_id, (error) ->
				return callback(error) if error?
				# get the updates as strings from redis (so we can delete them after they are applied)
				RedisManager.getOldestDocUpdates doc_id, UpdatesManager.REDIS_READ_BATCH_SIZE, (error, docUpdates) ->
					return callback(error) if error?
					length = docUpdates.length
					# parse the redis strings into ShareJs updates
					RedisManager.expandDocUpdates docUpdates, (error, rawUpdates) ->
						return callback(error) if error?
						UpdatesManager.compressAndSaveRawUpdates project_id, doc_id, rawUpdates, temporary, (error) ->
							return callback(error) if error?
							logger.log project_id: project_id, doc_id: doc_id, "compressed and saved doc updates"
							# delete the applied updates from redis
							RedisManager.deleteAppliedDocUpdates project_id, doc_id, docUpdates, (error) ->
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

	processUncompressedUpdatesForProject: (project_id, callback = (error) ->) ->
		RedisManager.getDocIdsWithHistoryOps project_id, (error, doc_ids) ->
			return callback(error) if error?
			jobs = []
			for doc_id in doc_ids
				do (doc_id) ->
					jobs.push (callback) ->
						UpdatesManager.processUncompressedUpdatesWithLock project_id, doc_id, callback
			async.parallelLimit jobs, 5, callback

	getDocUpdates: (project_id, doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.processUncompressedUpdatesWithLock project_id, doc_id, (error) ->
			return callback(error) if error?
			MongoManager.getDocUpdates doc_id, options, callback

	getDocUpdatesWithUserInfo: (project_id, doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.getDocUpdates project_id, doc_id, options, (error, updates) ->
			return callback(error) if error?
			UpdatesManager.fillUserInfo updates, (error, updates) ->
				return callback(error) if error?
				callback null, updates

	getProjectUpdates: (project_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.processUncompressedUpdatesForProject project_id, (error) ->
			return callback(error) if error?
			MongoManager.getProjectUpdates project_id, options, (error, updates) ->
				jobs = []
				for update in updates
					if update.inS3
						do (update) ->
							jobs.push (callback) -> DocArchiveManager.unArchiveDocChanges update.project_id, update.doc_id, callback
				if jobs.length?
					async.series jobs, (err) ->
						MongoManager.getProjectUpdates project_id, options, callback
				else
					callback(error, updates)

	getProjectUpdatesWithUserInfo: (project_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.getProjectUpdates project_id, options, (error, updates) ->
			return callback(error) if error?
			UpdatesManager.fillUserInfo updates, (error, updates) ->
				return callback(error) if error?
				callback null, updates

	getSummarizedProjectUpdates: (project_id, options = {}, callback = (error, updates) ->) ->
		options.min_count ||= 25
		summarizedUpdates = []
		before = options.before
		do fetchNextBatch = () ->
			UpdatesManager._extendBatchOfSummarizedUpdates project_id, summarizedUpdates, before, options.min_count, (error, updates, nextBeforeUpdate) ->
				return callback(error) if error?
				if !nextBeforeUpdate? or updates.length >= options.min_count
					callback null, updates, nextBeforeUpdate
				else
					before = nextBeforeUpdate
					summarizedUpdates = updates
					fetchNextBatch()

	_extendBatchOfSummarizedUpdates: (
		project_id,
		existingSummarizedUpdates,
		before, desiredLength,
		callback = (error, summarizedUpdates, endOfDatabase) ->
	) ->
		UpdatesManager.getProjectUpdatesWithUserInfo project_id, { before: before, limit: 3 * desiredLength }, (error, updates) ->
			return callback(error) if error?

			# Suppose in this request we have fetch the solid updates. In the next request we need
			# to fetch the dotted updates. These are defined by having an end timestamp less than
			# the last update's end timestamp (updates are ordered by descending end_ts). I.e.
			#                 start_ts--v       v--end_ts
			#   doc1: |......|  |...|   |-------|
			#   doc2:     |------------------|
			#                                ^----- Next time, fetch all updates with an
			#                                       end_ts less than this
			#          
			if updates? and updates.length > 0
				nextBeforeTimestamp = updates[updates.length - 1].meta.end_ts
				if nextBeforeTimestamp >= before
					error = new Error("history order is broken")
					logger.error err: error, project_id:project_id, nextBeforeTimestamp: nextBeforeTimestamp, before:before, "error in project history"
					return callback(error)
			else
				nextBeforeTimestamp = null

			summarizedUpdates = UpdatesManager._summarizeUpdates(
				updates, existingSummarizedUpdates
			)
			callback null,
				summarizedUpdates,
				nextBeforeTimestamp

	fillUserInfo: (updates, callback = (error, updates) ->) ->
		users = {}
		for update in updates
			if UpdatesManager._validUserId(update.meta.user_id)
				users[update.meta.user_id] = true

		jobs = []
		for user_id of users
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
				# check if the user in this update is already present in the earliest update,
				# if not, add them to the users list of the earliest update
				userExists = false
				for user in earliestUpdate.meta.users
					if (!user and !update.meta.user) or (user?.id == update.meta.user?.id)
						userExists = true
						break
				if !userExists
					earliestUpdate.meta.users.push update.meta.user

				doc_id = update.doc_id.toString()
				doc = earliestUpdate.docs[doc_id]
				if doc?
					doc.fromV = Math.min(doc.fromV, update.v)
					doc.toV = Math.max(doc.toV, update.v)
				else
					earliestUpdate.docs[doc_id] =
						fromV: update.v
						toV: update.v

				earliestUpdate.meta.start_ts = Math.min(earliestUpdate.meta.start_ts, update.meta.start_ts)
				earliestUpdate.meta.end_ts   = Math.max(earliestUpdate.meta.end_ts, update.meta.end_ts)
			else
				newUpdate =
					meta:
						users: []
						start_ts: update.meta.start_ts
						end_ts: update.meta.end_ts
					docs: {}

				newUpdate.docs[update.doc_id.toString()] =
					fromV: update.v
					toV: update.v
				newUpdate.meta.users.push update.meta.user
				summarizedUpdates.push newUpdate

		return summarizedUpdates
