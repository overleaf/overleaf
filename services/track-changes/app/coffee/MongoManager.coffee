{db, ObjectId} = require "./mongojs"
PackManager = require "./PackManager"
async = require "async"
logger = require "logger-sharelatex"

module.exports = MongoManager =
	getLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		db.docHistory
			.find(doc_id: ObjectId(doc_id.toString()))
			.sort( v: -1 )
			.limit(1)
			.toArray (error, compressedUpdates) ->
				return callback(error) if error?
				if compressedUpdates[0]?.pack?
					# cannot pop from a pack, throw error
					error = new Error("last compressed update is a pack")
					return callback error, null
				return callback null, compressedUpdates[0] or null

	deleteCompressedUpdate: (id, callback = (error) ->) ->
		db.docHistory.remove({ _id: ObjectId(id.toString()) }, callback)

	popLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		MongoManager.getLastCompressedUpdate doc_id, (error, update) ->
			return callback(error) if error?
			if update?
				MongoManager.deleteCompressedUpdate update._id, (error) ->
					return callback(error) if error?
					callback null, update
			else
				callback null, null

	insertCompressedUpdates: (project_id, doc_id, updates, temporary, callback = (error) ->) ->
		jobs = []
		for update in updates
			do (update) ->
				jobs.push (callback) -> MongoManager.insertCompressedUpdate project_id, doc_id, update, temporary, callback
		async.series jobs, (err, results) ->
			if not temporary
				# keep track of updates to be packed
				db.docHistoryStats.update {doc_id:ObjectId(doc_id)}, {
					$inc:{update_count:updates.length},
					$currentDate:{last_update:true}
				}, {upsert:true}, () ->
					callback(err,results)
			else
				callback(err,results)


	insertCompressedUpdate: (project_id, doc_id, update, temporary, callback = (error) ->) ->
		inS3 = update.inS3?
		update = {
			doc_id: ObjectId(doc_id.toString())
			project_id: ObjectId(project_id.toString())
			op:     update.op
			meta:   update.meta
			v:      update.v
		}
		if inS3
			update.inS3 = true
		
		if temporary
			seconds = 1000
			minutes = 60 * seconds
			hours = 60 * minutes
			days = 24 * hours
			update.expiresAt = new Date(Date.now() + 7 * days)
		# may need to roll over a pack here if we are inserting packs
		db.docHistory.insert update, callback

	getDocUpdates:(doc_id, options = {}, callback = (error, updates) ->) ->
		query = 
			doc_id: ObjectId(doc_id.toString())
		if options.from?
			query["v"] ||= {}
			query["v"]["$gte"] = options.from
		if options.to?
			query["v"] ||= {}
			query["v"]["$lte"] = options.to
			
		PackManager.findDocResults(db.docHistory, query, options.limit, callback)

	getProjectUpdates: (project_id, options = {}, callback = (error, updates) ->) ->
		query = 
			project_id: ObjectId(project_id.toString())

		if options.before?
			query["meta.end_ts"] = { $lt: options.before }

		PackManager.findProjectResults(db.docHistory, query, options.limit, callback)

	backportProjectId: (project_id, doc_id, callback = (error) ->) ->
		db.docHistory.update {
			doc_id: ObjectId(doc_id.toString())
			project_id: { $exists: false }
		}, {
			$set: { project_id: ObjectId(project_id.toString()) }
		}, {
			multi: true
		}, callback

	getProjectMetaData: (project_id, callback = (error, metadata) ->) ->
		db.projectHistoryMetaData.find {
			project_id: ObjectId(project_id.toString())
		}, (error, results) ->
			return callback(error) if error?
			callback null, results[0]

	setProjectMetaData: (project_id, metadata, callback = (error) ->) ->
		db.projectHistoryMetaData.update {
			project_id: ObjectId(project_id)
		}, {
			$set: metadata
		}, {
			upsert: true
		}, callback

	ensureIndices: () ->
		# For finding all updates that go into a diff for a doc
		db.docHistory.ensureIndex { doc_id: 1, v: 1 }, { background: true }
		# For finding all updates that affect a project
		db.docHistory.ensureIndex { project_id: 1, "meta.end_ts": 1 }, { background: true }
		# For finding all packs that affect a project (use a sparse index so only packs are included)
		db.docHistory.ensureIndex { project_id: 1, "pack.0.meta.end_ts": 1, "meta.end_ts": 1}, { background: true, sparse: true }
		# For finding updates that don't yet have a project_id and need it inserting
		db.docHistory.ensureIndex { doc_id: 1, project_id: 1 }, { background: true }
		# For finding project meta-data
		db.projectHistoryMetaData.ensureIndex { project_id: 1 }, { background: true }
		# TTL index for auto deleting week old temporary ops
		db.docHistory.ensureIndex { expiresAt: 1 }, { expireAfterSeconds: 0, background: true }
		# For finding documents which need packing
		db.docHistoryStats.ensureIndex { doc_id: 1 }, { background: true }
		db.docHistoryStats.ensureIndex { updates: -1, doc_id: 1 }, { background: true }

	getDocChangesCount: (doc_id, callback)->
		db.docHistory.count { doc_id : ObjectId(doc_id.toString()), inS3 : { $exists : false }}, {}, callback

	getArchivedDocChanges: (doc_id, callback)->
		db.docHistory.count { doc_id: ObjectId(doc_id.toString()) , inS3: true }, {}, callback

	markDocHistoryAsArchived: (doc_id, update, callback)->
		db.docHistory.update { _id: update._id }, { $set : { inS3 : true } }, (error)->
			return callback(error) if error?
			db.docHistory.remove { doc_id : ObjectId(doc_id.toString()), inS3 : { $exists : false }, v: { $lt : update.v }, expiresAt: {$exists : false} }, (error)->
				return callback(error) if error?
				callback(error)

	markDocHistoryAsUnarchived: (doc_id, callback)->
		db.docHistory.update { doc_id: ObjectId(doc_id.toString()) }, { $unset : { inS3 : true } }, { multi: true }, (error)->
			callback(error)
