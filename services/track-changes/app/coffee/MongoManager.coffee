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
				return callback null, null if compressedUpdates[0]?.pack? # cannot pop from a pack
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

	# The following function implements a method like a mongo find, but
	# which expands any documents containing a 'pack' field into
	# multiple values
	#
	#  e.g.  a single update looks like
	#
	#   {
	#     "doc_id" : 549dae9e0a2a615c0c7f0c98,
	#     "project_id" : 549dae9c0a2a615c0c7f0c8c,
	#     "op" : [ {"p" : 6981,	"d" : "?"	} ],
	#     "meta" : {	"user_id" : 52933..., "start_ts" : 1422310693931,	"end_ts" : 1422310693931 },
	#     "v" : 17082
	#   }
	#
	#  and a pack looks like this
	#
	#   {
	#     "doc_id" : 549dae9e0a2a615c0c7f0c98,
	#     "project_id" : 549dae9c0a2a615c0c7f0c8c,
	#     "pack" : [ D1, D2, D3, ....],
	#     "meta" : {	"user_id" : 52933..., "start_ts" : 1422310693931,	"end_ts" : 1422310693931 },
	#     "v" : 17082
	#   }
	#
	#  where D1, D2, D3, .... are single updates stripped of their
	#  doc_id and project_id fields (which are the same for all the
	#  updates in the pack).  The meta and v fields of the pack itself
	#  are those of the first entry in the pack D1 (this makes it
	#  possible to treat packs and single updates in the same way).


	_findDocResults: (query, limit, callback) ->
		# query - the mongo query selector, includes both the doc_id/project_id and
		# the range on v
		# limit - the mongo limit, we need to apply it after unpacking any
		# packs

		sort = {}
		sort['v'] = -1;
		cursor = db.docHistory
			.find( query )
			.sort( sort )
		# if we have packs, we will trim the results more later after expanding them
		if limit?
			cursor.limit(limit)

		# take the part of the query which selects the range over the parameter
		rangeQuery = query['v']

		# helper function to check if an item from a pack is inside the
		# desired range
		filterFn = (item) ->
			return false if rangeQuery?['$gte']? && item['v'] < rangeQuery['$gte']
			return false if rangeQuery?['$lte']? && item['v'] > rangeQuery['$lte']
			return false if rangeQuery?['$lt']? && item['v'] >= rangeQuery['$lt']
			return false if rangeQuery?['$gt']? && item['v'] <= rangeQuery['$gt']
			return true

		# create a query which can be used to select the entries BEFORE
		# the range because we sometimes need to find extra ones (when the
		# boundary falls in the middle of a pack)
		extraQuery = _.clone(query)
		# The pack uses its first entry for its metadata and v, so the
		# only queries where we might not get all the packs are those for
		# $gt and $gte (i.e. we need to find packs which start before our
		# range but end in it)
		if rangeQuery?['$gte']?
			extraQuery['v'] = {'$lt' : rangeQuery['$gte']}
		else if rangeQuery?['$gt']
			extraQuery['v'] = {'$lte' : rangeQuery['$gt']}
		else
			delete extraQuery['v']

		needMore = false  # keep track of whether we need to load more data
		updates = [] # used to accumulate the set of results
		cursor.toArray (err, result) ->
			unpackedSet = MongoManager._unpackResults(result)
			updates = MongoManager._filterAndLimit(updates, unpackedSet, filterFn, limit)
			# check if we need to retrieve more data, because there is a
			# pack that crosses into our range
			last = if unpackedSet.length then unpackedSet[unpackedSet.length-1] else null
			if limit? && updates.length == limit
				needMore = false
			else if extraQuery['v']? && last? && filterFn(last)
				needMore = true
			else if extraQuery['v']? && updates.length == 0
				needMore = true
			if needMore
				# we do need an extra result set
				extra = db.docHistory
					.find(extraQuery)
					.sort(sort)
					.limit(1)
				extra.toArray (err, result2) ->
					if err?
						return callback err, updates
					else
						extraSet = MongoManager._unpackResults(result2)
						updates = MongoManager._filterAndLimit(updates, extraSet, filterFn, limit)
						callback err, updates
				return
			if err?
				callback err, result
			else
				callback err, updates

	_findProjectResults: (query, limit, callback) ->
		# query - the mongo query selector, includes both the doc_id/project_id and
		# the range on v or meta.end_ts
		# limit - the mongo limit, we need to apply it after unpacking any
		# packs

		sort = {}
		sort['meta.end_ts'] = -1;
		cursor = db.docHistory
			.find( query, {"op":false, "pack.op": false} ) # no need to return the op only need version info
			.sort( sort )
		# if we have packs, we will trim the results more later after expanding them
		if limit?
			cursor.limit(limit)

		# take the part of the query which selects the range over the parameter
		before = query['meta.end_ts']?['$lt']  # may be null

		updates = [] # used to accumulate the set of results
		extraQuery = _.clone(query)

		cursor.toArray (err, result) ->
			if err?
				return callback err, result
			if result.length == 0 && not before?  # no results and no time range specified
				return callback err, result

			unpackedSet = MongoManager._unpackResults(result)
			if limit?
				unpackedSet = unpackedSet.slice(0, limit)
			# find the end time of the last result, we will take all the
			# results up to this, and then all the changes at that time
			# (without imposing a limit)
			cutoff = if unpackedSet.length then unpackedSet[unpackedSet.length-1].meta.end_ts else before
			console.log 'before is', before
			console.log 'cutoff is', cutoff
			console.log 'limit  is', limit

			filterFn = (item) ->
				ts = item?.meta?.end_ts
				return false if before? && ts >= before
				return false if cutoff? && ts < cutoff
				return true

			updates = MongoManager._filterAndLimit(updates, unpackedSet, filterFn, limit)
			console.log 'initial updates are', updates
			# now find any extra entries which are exactly at the last time (cutoff)
			# or in packs that overlap it
			extraQuery['meta.end_ts'] = {"$gte": +cutoff}
			extraQuery['meta.start_ts'] = {"$lte": +cutoff}
			# we don't specify a limit here, as there could be any number of
			# docs at that timestamp
			#
			# NB. need to catch items in original query and followup query for duplicates
			console.log 'extraQuery is', extraQuery
			extra = db.docHistory
				.find(extraQuery, {"op": false, "pack.op": false})
				.sort(sort)
			extra.toArray (err, result2) ->
				console.log 'got extra result', err, result
				if err?
					return callback err, updates
				else
					extraSet = MongoManager._unpackResults(result2)
					# note: final argument is null, no limit applied because we
					# need all the updates at the final time to avoid breaking
					# the changeset into parts
					updates = MongoManager._filterAndLimit(updates, extraSet, filterFn, null)
					# remove duplicates
					seen = {}
					updates = updates.filter (item) ->
						key = item.doc_id + ' ' + item.v
						console.log 'key is', key
						if seen[key]
							return false
						else
							seen[key] = true
					console.log 'extra updates are', updates
					callback err, updates


	_unpackResults: (updates) ->
		#	iterate over the updates, if there's a pack, expand it into ops and
		# insert it into the array at that point
		result = []
		updates.forEach (item) ->
			if item.pack?
				all = MongoManager._explodePackToOps item
				result = result.concat all
			else
				result.push item
		return result

	_explodePackToOps: (packObj) ->
		# convert a pack into an array of ops
		doc_id = packObj.doc_id
		project_id = packObj.project_id
		result = packObj.pack.map (item) ->
			item.doc_id = doc_id
			item.project_id = project_id
			item
		return result.reverse()

	_filterAndLimit: (results, extra, filterFn, limit) ->
		# update results with extra docs, after filtering and limiting
		filtered = extra.filter(filterFn)
		newResults = results.concat filtered
		newResults.slice(0, limit) if limit?
		return newResults

	getDocUpdates:(doc_id, options = {}, callback = (error, updates) ->) ->
		query = 
			doc_id: ObjectId(doc_id.toString())
		if options.from?
			query["v"] ||= {}
			query["v"]["$gte"] = options.from
		if options.to?
			query["v"] ||= {}
			query["v"]["$lte"] = options.to
			
		MongoManager._findDocResults(query, options.limit, callback)	

	getProjectUpdates: (project_id, options = {}, callback = (error, updates) ->) ->
		query = 
			project_id: ObjectId(project_id.toString())

		if options.before?
			query["meta.end_ts"] = { $lt: options.before }

		MongoManager._findProjectResults(query, options.limit, callback)	

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
