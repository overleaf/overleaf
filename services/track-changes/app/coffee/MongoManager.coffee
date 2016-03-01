{db, ObjectId} = require "./mongojs"
PackManager = require "./PackManager"
async = require "async"
_ = require "underscore"

module.exports = MongoManager =
	getLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		db.docHistory
			.find(doc_id: ObjectId(doc_id.toString()), {pack: {$slice:-1}}) # only return the last entry in a pack
			.sort( v: -1 )
			.limit(1)
			.toArray (error, compressedUpdates) ->
				return callback(error) if error?
				callback null, compressedUpdates[0] or null

	peekLastCompressedUpdate: (doc_id, callback = (error, update, version) ->) ->
		# under normal use we pass back the last update as
		# callback(null,update,version).
		#
		# when we have an existing last update but want to force a new one
		# to start, we pass it back as callback(null,null,version), just
		# giving the version so we can check consistency.
		MongoManager.getLastCompressedUpdate doc_id, (error, update) ->
			return callback(error) if error?
			if update?
				if update.broken
					# the update is marked as broken so we will force a new op
					return callback null, null
				else if update.pack?
					return callback null, update, update.pack[0]?.v
				else
					return callback null, update, update.v
			else
				PackManager.getLastPackFromIndex doc_id, (error, pack) ->
					return callback(error) if error?
					return callback(null, null, pack.v_end) if pack?.inS3? and pack?.v_end?
					callback null, null

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
		db.docHistory.ensureIndex { project_id: 1, "meta.end_ts": 1, "meta.start_ts": -1 }, { background: true }
		# For finding updates that don't yet have a project_id and need it inserting
		db.docHistory.ensureIndex { doc_id: 1, project_id: 1 }, { background: true }
		# For finding project meta-data
		db.projectHistoryMetaData.ensureIndex { project_id: 1 }, { background: true }
		# TTL index for auto deleting week old temporary ops
		db.docHistory.ensureIndex { expiresAt: 1 }, { expireAfterSeconds: 0, background: true }
		# For finding packs to be checked for archiving
		db.docHistory.ensureIndex { last_checked: 1 }, { background: true }
		# For finding archived packs
		db.docHistoryIndex.ensureIndex { project_id: 1 }, { background: true }
