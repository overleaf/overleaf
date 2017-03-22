MongoManager = require "./MongoManager"
PackManager = require "./PackManager"
RedisManager = require "./RedisManager"
UpdateCompressor = require "./UpdateCompressor"
LockManager = require "./LockManager"
WebApiManager = require "./WebApiManager"
UpdateTrimmer = require "./UpdateTrimmer"
logger = require "logger-sharelatex"
async = require "async"
_ = require "underscore"
Settings = require "settings-sharelatex"

module.exports = UpdatesManager =
	compressAndSaveRawUpdates: (project_id, doc_id, rawUpdates, temporary, callback = (error) ->) ->
		length = rawUpdates.length
		if length == 0
			return callback()

		# FIXME: we no longer need the lastCompressedUpdate, so change functions not to need it
		# CORRECTION:  we do use it to log the time in case of error
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
				discardedUpdates = []
				rawUpdates = rawUpdates.slice(0)
				while rawUpdates[0]? and rawUpdates[0].v <= lastVersion
					discardedUpdates.push rawUpdates.shift()
				if discardedUpdates.length
					logger.error project_id: project_id, doc_id: doc_id, discardedUpdates: discardedUpdates, temporary: temporary, lastVersion: lastVersion, "discarded updates already present"

				if rawUpdates[0]? and rawUpdates[0].v != lastVersion + 1
					ts = lastCompressedUpdate?.meta?.end_ts
					last_timestamp = if ts? then new Date(ts) else 'unknown time'
					error = new Error("Tried to apply raw op at version #{rawUpdates[0].v} to last compressed update with version #{lastVersion} from #{last_timestamp}")
					logger.error err: error, doc_id: doc_id, project_id: project_id, prev_end_ts: ts, temporary: temporary, lastCompressedUpdate: lastCompressedUpdate, "inconsistent doc versions"
					if Settings.trackchanges?.continueOnError and rawUpdates[0].v > lastVersion + 1
						# we have lost some ops - continue to write into the database, we can't recover at this point
						lastCompressedUpdate = null
					else
						return callback error

			if rawUpdates.length == 0
				return callback()

			# some old large ops in redis need to be rejected, they predate
			# the size limit that now prevents them going through the system
			REJECT_LARGE_OP_SIZE = 4 * 1024 * 1024
			for rawUpdate in rawUpdates
				opSizes = ((op.i?.length || op.d?.length) for op in rawUpdate?.op or [])
				size = _.max opSizes
				if size > REJECT_LARGE_OP_SIZE
					error = new Error("dropped op exceeding maximum allowed size of #{REJECT_LARGE_OP_SIZE}")
					logger.error err: error, doc_id: doc_id, project_id: project_id, size: size, rawUpdate: rawUpdate, "dropped op - too big"
					rawUpdate.op = []

			compressedUpdates = UpdateCompressor.compressRawUpdates null, rawUpdates
			PackManager.insertCompressedUpdates project_id, doc_id, lastCompressedUpdate, compressedUpdates, temporary, (error, result) ->
				return callback(error) if error?
				logger.log {project_id, doc_id, orig_v: lastCompressedUpdate?.v, new_v: result.v}, "inserted updates into pack"	if result?
				callback()

	# Check whether the updates are temporary (per-project property)
	_prepareProjectForUpdates: (project_id, callback = (error, temporary) ->) ->
		UpdateTrimmer.shouldTrimUpdates project_id, (error, temporary) ->
			return callback(error) if error?
			callback(null, temporary)

	# Check for project id on document history (per-document property)
	_prepareDocForUpdates: (project_id, doc_id, callback = (error) ->) ->
		MongoManager.backportProjectId project_id, doc_id, (error) ->
			return callback(error) if error?
			callback(null)

	# Apply updates for specific project/doc after preparing at project and doc level
	REDIS_READ_BATCH_SIZE: 100
	processUncompressedUpdates: (project_id, doc_id, temporary, callback = (error) ->) ->
		# get the updates as strings from redis (so we can delete them after they are applied)
		RedisManager.getOldestDocUpdates doc_id, UpdatesManager.REDIS_READ_BATCH_SIZE, (error, docUpdates) ->
			return callback(error) if error?
			length = docUpdates.length
			# parse the redis strings into ShareJs updates
			RedisManager.expandDocUpdates docUpdates, (error, rawUpdates) ->
				return callback(error) if error?
				logger.log project_id: project_id, doc_id: doc_id, rawUpdates: rawUpdates, "retrieved raw updates from redis"
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
								UpdatesManager.processUncompressedUpdates project_id, doc_id, temporary, callback
							, 0
						else
							logger.log project_id: project_id, doc_id: doc_id, "all raw updates processed"
							callback()

	# Process updates for a doc when we flush it individually
	processUncompressedUpdatesWithLock: (project_id, doc_id, callback = (error) ->) ->
		UpdatesManager._prepareProjectForUpdates project_id, (error, temporary) ->
			return callback(error) if error?
			UpdatesManager._processUncompressedUpdatesForDocWithLock project_id, doc_id, temporary, callback


	# Process updates for a doc when the whole project is flushed (internal method)
	_processUncompressedUpdatesForDocWithLock: (project_id, doc_id, temporary, callback = (error) ->) ->
		UpdatesManager._prepareDocForUpdates project_id, doc_id, (error) ->
			return callback(error) if error?
			LockManager.runWithLock(
				"HistoryLock:#{doc_id}",
				(releaseLock) ->
					UpdatesManager.processUncompressedUpdates project_id, doc_id, temporary, releaseLock
				callback
			)

	# Process all updates for a project, only check project-level information once
	processUncompressedUpdatesForProject: (project_id, callback = (error) ->) ->
		RedisManager.getDocIdsWithHistoryOps project_id, (error, doc_ids) ->
			return callback(error) if error?
			UpdatesManager._prepareProjectForUpdates project_id, (error, temporary) ->
				jobs = []
				for doc_id in doc_ids
					do (doc_id) ->
						jobs.push (cb) ->
							UpdatesManager._processUncompressedUpdatesForDocWithLock project_id, doc_id, temporary, cb
				async.parallelLimit jobs, 5, callback

	getDocUpdates: (project_id, doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.processUncompressedUpdatesWithLock project_id, doc_id, (error) ->
			return callback(error) if error?
			#console.log "options", options
			PackManager.getOpsByVersionRange project_id, doc_id, options.from, options.to, (error, updates) ->
				return callback(error) if error?
				callback null, updates

	getDocUpdatesWithUserInfo: (project_id, doc_id, options = {}, callback = (error, updates) ->) ->
		UpdatesManager.getDocUpdates project_id, doc_id, options, (error, updates) ->
			return callback(error) if error?
			UpdatesManager.fillUserInfo updates, (error, updates) ->
				return callback(error) if error?
				callback null, updates

	getSummarizedProjectUpdates: (project_id, options = {}, callback = (error, updates) ->) ->
		options.min_count ||= 25
		summarizedUpdates = []
		before = options.before
		nextBeforeTimestamp = null
		UpdatesManager.processUncompressedUpdatesForProject project_id, (error) ->
			return callback(error) if error?
			PackManager.makeProjectIterator project_id, before, (err, iterator) ->
				return callback(err) if err?
				# repeatedly get updates and pass them through the summariser to get an final output with user info
				async.whilst () ->
					#console.log "checking iterator.done", iterator.done()
					return summarizedUpdates.length < options.min_count and not iterator.done()
				, (cb) ->
					iterator.next (err, partialUpdates) ->
						return callback(err) if err?
						#logger.log {partialUpdates}, 'got partialUpdates'
						return cb() if partialUpdates.length is 0 ## FIXME should try to avoid this happening
						nextBeforeTimestamp = partialUpdates[partialUpdates.length - 1].meta.end_ts
						# add the updates to the summary list
						summarizedUpdates = UpdatesManager._summarizeUpdates partialUpdates, summarizedUpdates
						cb()
				, () ->
					# finally done all updates
					#console.log 'summarized Updates', summarizedUpdates
					UpdatesManager.fillSummarizedUserInfo summarizedUpdates, (err, results) ->
						return callback(err) if err?
						callback null, results,	if not iterator.done() then nextBeforeTimestamp else undefined

	fetchUserInfo: (users, callback = (error, fetchedUserInfo) ->) ->
		jobs = []
		fetchedUserInfo = {}
		for user_id of users
			do (user_id) ->
				jobs.push (callback) ->
					WebApiManager.getUserInfo user_id, (error, userInfo) ->
						return callback(error) if error?
						fetchedUserInfo[user_id] = userInfo
						callback()

		async.series jobs, (err) ->
			return callback(err) if err?
			callback(null, fetchedUserInfo)

	fillUserInfo: (updates, callback = (error, updates) ->) ->
		users = {}
		for update in updates
			user_id = update.meta.user_id
			if UpdatesManager._validUserId(user_id)
				users[user_id] = true

		UpdatesManager.fetchUserInfo users, (error, fetchedUserInfo) ->
			return callback(error) if error?
			for update in updates
				user_id = update.meta.user_id
				delete update.meta.user_id
				if UpdatesManager._validUserId(user_id)
					update.meta.user = fetchedUserInfo[user_id]
			callback null, updates

	fillSummarizedUserInfo: (updates, callback = (error, updates) ->) ->
		users = {}
		for update in updates
			user_ids = update.meta.user_ids or []
			for user_id in user_ids
				if UpdatesManager._validUserId(user_id)
					users[user_id] = true

		UpdatesManager.fetchUserInfo users, (error, fetchedUserInfo) ->
			return callback(error) if error?
			for update in updates
				user_ids = update.meta.user_ids or []
				update.meta.users = []
				delete update.meta.user_ids
				for user_id in user_ids
					if UpdatesManager._validUserId(user_id)
						update.meta.users.push fetchedUserInfo[user_id]
					else
						update.meta.users.push null
			callback null, updates

	_validUserId: (user_id) ->
		if !user_id?
			return false
		else
			return !!user_id.match(/^[a-f0-9]{24}$/)

	TIME_BETWEEN_DISTINCT_UPDATES: fiveMinutes = 5 * 60 * 1000
	SPLIT_ON_DELETE_SIZE: 16 # characters
	_summarizeUpdates: (updates, existingSummarizedUpdates = []) ->
		summarizedUpdates = existingSummarizedUpdates.slice()
		previousUpdateWasBigDelete = false
		for update in updates
			earliestUpdate = summarizedUpdates[summarizedUpdates.length - 1]
			shouldConcat = false

			# If a user inserts some text, then deletes a big chunk including that text,
			# the update we show might concat the insert and delete, and there will be no sign
			# of that insert having happened, or be able to restore to it (restoring after a big delete is common).
			# So, we split the summary on 'big' deletes. However, we've stepping backwards in time with
			# most recent changes considered first, so if this update is a big delete, we want to start
			# a new summarized update next timge, hence we monitor the previous update.
			if previousUpdateWasBigDelete
				shouldConcat = false
			else if earliestUpdate and earliestUpdate.meta.end_ts - update.meta.start_ts < @TIME_BETWEEN_DISTINCT_UPDATES
				# We're going backwards in time through the updates, so only combine if this update starts less than 5 minutes before
				# the end of current summarized block, so no block spans more than 5 minutes.
				shouldConcat = true

			isBigDelete = false
			for op in update.op or []
				if op.d? and op.d.length > @SPLIT_ON_DELETE_SIZE
					isBigDelete = true

			previousUpdateWasBigDelete = isBigDelete

			if shouldConcat
				# check if the user in this update is already present in the earliest update,
				# if not, add them to the users list of the earliest update
				earliestUpdate.meta.user_ids = _.union earliestUpdate.meta.user_ids, [update.meta.user_id]

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
						user_ids: []
						start_ts: update.meta.start_ts
						end_ts: update.meta.end_ts
					docs: {}

				newUpdate.docs[update.doc_id.toString()] =
					fromV: update.v
					toV: update.v
				newUpdate.meta.user_ids.push update.meta.user_id
				summarizedUpdates.push newUpdate

		return summarizedUpdates
