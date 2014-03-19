{db, ObjectId} = require "./mongojs"
async = require "async"

module.exports = MongoManager =
	getLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		db.docHistory
			.find(doc_id: ObjectId(doc_id.toString()))
			.sort( v: -1 )
			.limit(1)
			.toArray (error, compressedUpdates) ->
				return callback(error) if error?
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

	insertCompressedUpdates: (project_id, doc_id, updates, callback = (error) ->) ->
		jobs = []
		for update in updates
			do (update) ->
				jobs.push (callback) -> MongoManager.insertCompressedUpdate project_id, doc_id, update, callback
		async.series jobs, callback

	insertCompressedUpdate: (project_id, doc_id, update, callback = (error) ->) ->
		db.docHistory.insert {
			doc_id: ObjectId(doc_id.toString())
			project_id: ObjectId(project_id.toString())
			op:     update.op
			meta:   update.meta
			v:      update.v
		}, callback

	getUpdates:(doc_id, options = {}, callback = (error, updates) ->) ->
		query = 
			doc_id: ObjectId(doc_id.toString())
		if options.from?
			query["v"] ||= {}
			query["v"]["$gte"] = options.from
		if options.to?
			query["v"] ||= {}
			query["v"]["$lte"] = options.to
			
		cursor = db.docHistory
			.find( query )
			.sort( v: -1 )

		if options.limit?
			cursor.limit(options.limit)

		cursor.toArray callback

	ensureIndices: (callback = (error) ->) ->
		db.docHistory.ensureIndex { doc_id: 1, v: 1 }, callback

