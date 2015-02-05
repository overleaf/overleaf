{db, ObjectId} = require "./mongojs"
async = require "async"
_ = require "underscore"

module.exports = MongoManager =
	# only used in this module
	getLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		db.docHistory
			.find(doc_id: ObjectId(doc_id.toString()))
			.sort( v: -1 )
			.limit(1)
			.toArray (error, compressedUpdates) ->
				return callback(error) if error?
				return callback null, compressedUpdates[0] or null

	# only used in this module
	deleteCompressedUpdate: (id, callback = (error) ->) ->
		db.docHistory.remove({ _id: ObjectId(id.toString()) }, callback)

	# used in UpdatesManager
	popLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		MongoManager.getLastCompressedUpdate doc_id, (error, update) ->
			return callback(error) if error?
			if update?
				MongoManager.deleteCompressedUpdate update._id, (error) ->
					return callback(error) if error?
					callback null, update
			else
				callback null, null

	# used in UpdatesManager
	insertCompressedUpdates: (project_id, doc_id, updates, permanent, callback = (error) ->) ->
		jobs = []
		for update in updates
			do (update) ->
				jobs.push (callback) -> MongoManager.insertCompressedUpdate project_id, doc_id, update, permanent, callback
		async.series jobs, callback

	insertCompressedUpdate: (project_id, doc_id, update, temporary, callback = (error) ->) ->
		update = {
			doc_id: ObjectId(doc_id.toString())
			project_id: ObjectId(project_id.toString())
			op:     update.op
			meta:   update.meta
			v:      update.v
		}
		if temporary
			seconds = 1000
			minutes = 60 * seconds
			hours = 60 * minutes
			days = 24 * hours
			update.expiresAt = new Date(Date.now() + 7 * days)
		# may need to roll over a pack here if we are inserting packs
		db.docHistory.insert update, callback

	_findResults: (param, query, limit, callback) ->
		sort = {}
		sort[param] = -1;
		cursor = db.docHistory
			.find( query )
			.sort( sort )

		if limit?
			cursor.limit(limit)

		rangeQuery = query[param]
		extraQuery = _.clone(query)
		if rangeQuery?['$gte']?
			extraQuery[param] = {'$lt' : rangeQuery['$gte']}
		else if rangeQuery?['$gt']
			extraQuery[param] = {'$lte' : rangeQuery['$gt']}

		filterFn = (item) ->
			#console.log 'filter', item, rangeQuery
			return false if rangeQuery?['$gte']? && item[param] < rangeQuery['$gte']
			return false if rangeQuery?['$lte']? && item[param] > rangeQuery['$lte']
			return false if rangeQuery?['$lt']? && item[param] >= rangeQuery['$lt']
			return false if rangeQuery?['$gt']? && item[param] <= rangeQuery['$gt']
			#console.log 'accepted'
			return true

		# need to support limit here
			
		cursor.toArray (err, updates) ->
			console.log 'query=', query, 'UPDATES=', updates
			all = MongoManager._unpackResults(updates).filter(filterFn)
			if all.length == 0 
				# need an extra result set
				console.log 'extraQuery', extraQuery
				extra = db.docHistory
					.find(extraQuery)
					.sort(sort)
					.limit(1)
				extra.toArray (err, updates2) ->
					all2 = MongoManager._unpackResults(updates2).filter(filterFn)
					console.log 'got extra', all2
					callback err, all2
				return
			if err?
				callback err, updates
			else
				callback err, all

	_unpackResults: (updates) ->
		result = []
		# iterate over the updates
		# if it's a pack, expand it into ops and insert it into the array at that point
		updates.forEach (item) ->
			if item.pack?
				all = MongoManager._explodePackToOps item
				result = result.concat all
			else
				result.push item
		return result

	_explodePackToOps: (packObj) ->
		doc_id = packObj.doc_id
		project_id = packObj.project_id
		result = packObj.pack.map (item) ->
			item.doc_id = doc_id
			item.project_id = project_id
			item
		return result.reverse()
		
	getDocUpdates:(doc_id, options = {}, callback = (error, updates) ->) ->
		query = 
			doc_id: ObjectId(doc_id.toString())
		if options.from?
			query["v"] ||= {}
			query["v"]["$gte"] = options.from
		if options.to?
			query["v"] ||= {}
			query["v"]["$lte"] = options.to
			
		MongoManager._findResults('v', query, options.limit, callback)	

	getProjectUpdates: (project_id, options = {}, callback = (error, updates) ->) ->
		query = 
			project_id: ObjectId(project_id.toString())

		if options.before?
			query["meta.end_ts"] = { $lt: options.before }

		MongoManager._findResults('meta.end_ts', query, options.limit, callback)	

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
		# For finding all updates that go into a diff for a doc  (getLastCompressedUpdate, getDocUpdates v > from && v < to)
		db.docHistory.ensureIndex { doc_id: 1, v: 1 }, { background: true }
		# For finding all updates that affect a project (getProjectUpdates meta.end_ts < before
		db.docHistory.ensureIndex { project_id: 1, "meta.end_ts": 1 }, { background: true }
		# For finding updates that don't yet have a project_id and need it inserting
		db.docHistory.ensureIndex { doc_id: 1, project_id: 1 }, { background: true }
		# For finding project meta-data
		db.projectHistoryMetaData.ensureIndex { project_id: 1 }, { background: true }
		# TTL index for auto deleting week old temporary ops
		db.docHistory.ensureIndex { expiresAt: 1 }, { expireAfterSeconds: 0, background: true }
