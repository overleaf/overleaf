async = require "async"
_ = require "underscore"
{db, ObjectId, BSON} = require "./mongojs"
logger = require "logger-sharelatex"
LockManager = require "./LockManager"

DAYS = 24 * 3600 * 1000 # one day in milliseconds

module.exports = PackManager =
	# The following functions implement methods like a mongo find, but
	# expands any documents containing a 'pack' field into multiple
	# values
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
	#     "pack" : [ U1, U2, U3, ...., UN],
	#     "meta" : {	"user_id" : 52933..., "start_ts" : 1422310693931,	"end_ts" : 1422310693931 },
	#     "v" : 17082
	#   }
	#
	#  where U1, U2, U3, .... are single updates stripped of their
	#  doc_id and project_id fields (which are the same for all the
	#  updates in the pack).
	#
	#  The pack itself has v and meta fields, this makes it possible to
	#  treat packs and single updates in the same way.
	#
	#  The v field of the pack itself is from the first entry U1
	#  The meta.end_ts field of the pack itself is from the last entry UN.

	findDocResults: (collection, query, limit, callback) ->
		# query - the mongo query selector, includes both the doc_id/project_id and
		# the range on v
		# limit - the mongo limit, we need to apply it after unpacking any
		# packs

		sort = {}
		sort['v'] = -1;
		cursor = collection
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

		versionOrder = (a, b) ->
			b.v - a.v

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

		# FIXME: packs are big so we should accumulate the results
		# incrementally instead of using .toArray() to avoid reading all
		# of the changes into memory
		cursor.toArray (err, result) ->
			unpackedSet = PackManager._unpackResults(result)
			updates = PackManager._filterAndLimit(updates, unpackedSet, filterFn, limit)
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
				extra = collection
					.find(extraQuery)
					.sort(sort)
					.limit(1)
				extra.toArray (err, result2) ->
					if err?
						return callback err, updates.sort versionOrder
					else
						extraSet = PackManager._unpackResults(result2)
						updates = PackManager._filterAndLimit(updates, extraSet, filterFn, limit)
						callback err, updates.sort versionOrder
				return
			if err?
				callback err, result
			else
				callback err, updates.sort versionOrder

	findProjectResults: (collection, query, limit, callback) ->
		# query - the mongo query selector, includes both the doc_id/project_id and
		# the range on meta.end_ts
		# limit - the mongo limit, we need to apply it after unpacking any
		# packs

		sort = {}
		sort['meta.end_ts'] = -1;

		projection = {"op":false, "pack.op": false}
		cursor = collection
			.find( query, projection ) # no need to return the op only need version info
			.sort( sort )
		# if we have packs, we will trim the results more later after expanding them
		if limit?
			cursor.limit(limit)

		# take the part of the query which selects the range over the parameter
		before = query['meta.end_ts']?['$lt']  # may be null

		updates = [] # used to accumulate the set of results

		# FIXME: packs are big so we should accumulate the results
		# incrementally instead of using .toArray() to avoid reading all
		# of the changes into memory
		cursor.toArray (err, result) ->
			if err?
				return callback err, result
			if result.length == 0 && not before?  # no results and no time range specified
				return callback err, result

			unpackedSet = PackManager._unpackResults(result)
			if limit?
				unpackedSet = unpackedSet.slice(0, limit)
			# find the end time of the last result, we will take all the
			# results up to this, and then all the changes at that time
			# (without imposing a limit) and any overlapping packs
			cutoff = if unpackedSet.length then unpackedSet[unpackedSet.length-1].meta.end_ts else null

			filterFn = (item) ->
				ts = item?.meta?.end_ts
				return false if before? && ts >= before
				return false if cutoff? && ts < cutoff
				return true

			timeOrder = (a, b) ->
				(b.meta.end_ts - a.meta.end_ts) || documentOrder(a, b)

			documentOrder = (a, b) ->
				x = a.doc_id.valueOf()
				y = b.doc_id.valueOf()
				if x > y then 1 else if x < y then -1 else 0

			updates = PackManager._filterAndLimit(updates, unpackedSet, filterFn, limit)

			# get all elements on the lower bound (cutoff)
			tailQuery = _.clone(query)
			tailQuery['meta.end_ts'] = cutoff
			tail = collection
				.find(tailQuery, projection)
				.sort(sort)

			# now find any packs that overlap with the time window from outside
			#     cutoff             before
			#    --|-----wanted-range--|------------------  time=>
			#                  |-------------|pack(end_ts)
			#
			# these were not picked up by the original query because
			# end_ts>before but the beginning of the pack may be in the time range
			overlapQuery = _.clone(query)
			if before? && cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": before}
				overlapQuery['meta.start_ts'] = {"$lte": before }
			else if before? && not cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": before}
				overlapQuery['meta.start_ts'] = {"$lte": before }
			else if not before? && cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": cutoff}  # we already have these??
			else if not before? && not cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": 0 } # shouldn't happen??

			overlap = collection
				.find(overlapQuery, projection)
				.sort(sort)

			# we don't specify a limit here, as there could be any number of overlaps
			# NB. need to catch items in original query and followup query for duplicates

			applyAndUpdate = (result) ->
				extraSet = PackManager._unpackResults(result)
				# note: final argument is null, no limit applied because we
				# need all the updates at the final time to avoid breaking
				# the changeset into parts
				updates = PackManager._filterAndLimit(updates, extraSet, filterFn, null)
			tail.toArray (err, result2) ->
				if err?
					return callback err, updates.sort timeOrder
				else
					applyAndUpdate result2
					overlap.toArray (err, result3) ->
						if err?
							return callback err, updates.sort timeOrder
						else
							applyAndUpdate result3
							callback err, updates.sort timeOrder

	_unpackResults: (updates) ->
		#	iterate over the updates, if there's a pack, expand it into ops and
		# insert it into the array at that point
		result = []
		updates.forEach (item) ->
			if item.pack?
				all = PackManager._explodePackToOps item
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
		# remove duplicates
		seen = {}
		newResults = newResults.filter (item) ->
			key = item.doc_id + ' ' + item.v
			if seen[key]
				return false
			else
				seen[key] = true
			return true
		newResults.slice(0, limit) if limit?
		return newResults

	MAX_SIZE:  1024*1024 # make these configurable parameters
	MAX_COUNT: 512

	convertDocsToPacks: (docs, callback) ->
		packs = []
		top = null
		docs.forEach (d,i) ->
			# skip existing packs
			if d.pack?
				top = null
				return
			# skip temporary ops (we could pack these into temporary packs in future)
			if d.expiresAt?
				top = null
				return
			sz = BSON.calculateObjectSize(d)
			if top?	&& top.pack.length < PackManager.MAX_COUNT && top.sz + sz < PackManager.MAX_SIZE
				top.pack = top.pack.concat {v: d.v, meta: d.meta,  op: d.op, _id: d._id}
				top.sz += sz
				top.n += 1
				top.v_end = d.v
				top.meta.end_ts = d.meta.end_ts
				return
			else
				# create a new pack
				top = _.clone(d)
				top.pack = [ {v: d.v, meta: d.meta,  op: d.op, _id: d._id} ]
				top.meta = { start_ts: d.meta.start_ts, end_ts: d.meta.end_ts }
				top.sz = sz
				top.n = 1
				top.v_end = d.v
				delete top.op
				delete top._id
				packs.push top

		callback(null, packs)

	checkHistory: (docs, callback) ->
		errors = []
		prev = null
		error = (args...) ->
			errors.push args
		docs.forEach (d,i) ->
			if d.pack?
				n = d.pack.length
				last = d.pack[n-1]
				error('bad pack v_end', d) if d.v_end != last.v
				error('bad pack start_ts', d) if d.meta.start_ts != d.pack[0].meta.start_ts
				error('bad pack end_ts', d) if d.meta.end_ts != last.meta.end_ts
				d.pack.forEach (p, i) ->
					prev = v
					v = p.v
					error('bad version', v, 'in', p) if v <= prev
					#error('expired op', p, 'in pack') if p.expiresAt?
			else
				prev = v
				v = d.v
				error('bad version', v, 'in', d) if v <= prev
		if errors.length
			callback(errors)
		else
			callback()

	insertPack: (packObj, callback) ->
		bulk = db.docHistory.initializeOrderedBulkOp()
		doc_id = packObj.doc_id
		expect_nInserted = 1
		expect_nRemoved = packObj.pack.length
		logger.log {doc_id: doc_id}, "adding pack, removing #{expect_nRemoved} ops"
		bulk.insert packObj
		ids = (op._id for op in packObj.pack)
		bulk.find({_id:{$in:ids}}).remove()
		bulk.execute (err, result) ->
			if err?
				logger.error {doc_id: doc_id}, "error adding pack"
				callback(err, result)
			else if result.nInserted != expect_nInserted or result.nRemoved != expect_nRemoved
				logger.error {doc_id: doc_id, result}, "unexpected result adding pack"
				callback(new Error(
					msg: 'unexpected result'
					expected: {expect_nInserted, expect_nRemoved}
				), result)
			else
				db.docHistoryStats.update {doc_id:doc_id}, {
					$inc:{update_count:-expect_nRemoved},
					$currentDate:{last_packed:true}
				}, {upsert:true}, () ->
					callback(err, result)

	# retrieve document ops/packs and check them
	getDocHistory: (doc_id, callback) ->
		db.docHistory.find({doc_id:ObjectId(doc_id)}).sort {v:1}, (err, docs) ->
			return callback(err) if err?
			# for safety, do a consistency check of the history
			logger.log {doc_id}, "checking history for document"
			PackManager.checkHistory docs, (err) ->
				return callback(err) if err?
				callback(err, docs)
				#PackManager.deleteExpiredPackOps docs, (err) ->
				#	return callback(err) if err?
				#	callback err, docs

	packDocHistory: (doc_id, options, callback) ->
		if typeof callback == "undefined" and typeof options == 'function'
			callback = options
			options = {}
		LockManager.runWithLock(
			"HistoryLock:#{doc_id}",
			(releaseLock) ->
				PackManager._packDocHistory(doc_id, options, releaseLock)
			,	callback
		)

	_packDocHistory: (doc_id, options, callback) ->
		logger.log {doc_id},"starting pack operation for document history"

		PackManager.getDocHistory doc_id, (err, docs) ->
			return callback(err) if err?
			origDocs = 0
			origPacks = 0
			for d in docs
				if d.pack? then	origPacks++	else origDocs++
			PackManager.convertDocsToPacks docs, (err, packs) ->
				return callback(err) if err?
				total = 0
				for p in packs
					total = total + p.pack.length
				logger.log {doc_id, origDocs, origPacks, newPacks: packs.length, totalOps: total}, "document stats"
				if packs.length
					if options['dry-run']
						logger.log {doc_id}, 'dry-run, skipping write packs'
						return callback()
					PackManager.savePacks packs, (err) ->
						return callback(err) if err?
						# check the history again
						PackManager.getDocHistory doc_id, callback
				else
					logger.log {doc_id}, "no packs to write"
					# keep a record that we checked this one to avoid rechecking it
					db.docHistoryStats.update {doc_id:doc_id}, {
						$currentDate:{last_checked:true}
					}, {upsert:true}, () ->
						callback null, null

	DB_WRITE_DELAY: 100

	savePacks: (packs, callback) ->
		async.eachSeries packs, PackManager.safeInsert, (err, result) ->
			if err?
				logger.log {err, result}, "error writing packs"
				callback err, result
			else
				callback()

	safeInsert: (packObj, callback) ->
		PackManager.insertPack packObj, (err, result) ->
			setTimeout () ->
				callback(err,result)
			, PackManager.DB_WRITE_DELAY

	deleteExpiredPackOps: (docs, callback) ->
		now = Date.now()
		toRemove = []
		toUpdate = []
		docs.forEach (d,i) ->
			if d.pack?
				newPack = d.pack.filter (op) ->
					if op.expiresAt? then op.expiresAt > now else true
				if newPack.length == 0
					toRemove.push d
				else if newPack.length < d.pack.length
					# adjust the pack properties
					d.pack = newPack
					first = d.pack[0]
					last = d.pack[d.pack.length - 1]
					d.v_end = last.v
					d.meta.start_ts = first.meta.start_ts
					d.meta.end_ts = last.meta.end_ts
					toUpdate.push d
		if toRemove.length or toUpdate.length
			bulk = db.docHistory.initializeOrderedBulkOp()
			toRemove.forEach (pack) ->
				console.log "would remove", pack
				#bulk.find({_id:pack._id}).removeOne()
			toUpdate.forEach (pack) ->
				console.log "would update", pack
				#bulk.find({_id:pack._id}).updateOne(pack);
			bulk.execute callback
		else
			callback()

	insertCompressedUpdates: (project_id, doc_id, lastUpdate, newUpdates, temporary, callback = (error) ->) ->
		return callback() if newUpdates.length == 0

		updatesToFlush = []
		updatesRemaining = newUpdates.slice()

		n = lastUpdate?.n || 0
		sz = lastUpdate?.sz || 0

		while updatesRemaining.length and n < PackManager.MAX_COUNT and sz < PackManager.MAX_SIZE
			nextUpdate = updatesRemaining[0]
			nextUpdateSize = BSON.calculateObjectSize(nextUpdate)
			if nextUpdateSize + sz > PackManager.MAX_SIZE and n > 0
				break
			n++
			sz += nextUpdateSize
			updatesToFlush.push updatesRemaining.shift()

		PackManager.flushCompressedUpdates project_id, doc_id, lastUpdate, updatesToFlush, temporary, (error) ->
			return callback(error) if error?
			PackManager.insertCompressedUpdates project_id, doc_id, null, updatesRemaining, temporary, callback

	flushCompressedUpdates:	(project_id, doc_id, lastUpdate, newUpdates, temporary, callback = (error) ->) ->
		return callback() if newUpdates.length == 0
		if lastUpdate? and not (temporary and ((Date.now() - lastUpdate.meta?.start_ts) > 1 * DAYS))
			PackManager.appendUpdatesToExistingPack project_id, doc_id, lastUpdate, newUpdates, temporary, callback
		else
			PackManager.insertUpdatesIntoNewPack project_id, doc_id, newUpdates, temporary, callback

	insertUpdatesIntoNewPack: (project_id, doc_id, newUpdates, temporary, callback = (error) ->) ->
		first = newUpdates[0]
		last = newUpdates[newUpdates.length - 1]
		n = newUpdates.length
		sz = BSON.calculateObjectSize(newUpdates)
		newPack =
			project_id: ObjectId(project_id.toString())
			doc_id: ObjectId(doc_id.toString())
			pack: newUpdates
			n: n
			sz: sz
			meta:
				start_ts: first.meta.start_ts
				end_ts: last.meta.end_ts
			v: first.v
			v_end: last.v
		if temporary
			newPack.expiresAt = new Date(Date.now() + 7 * DAYS)
		logger.log {project_id, doc_id, newUpdates}, "inserting updates into new pack"
		db.docHistory.insert newPack, callback

	appendUpdatesToExistingPack: (project_id, doc_id, lastUpdate, newUpdates, temporary, callback = (error) ->) ->
		first = newUpdates[0]
		last = newUpdates[newUpdates.length - 1]
		n = newUpdates.length
		sz = BSON.calculateObjectSize(newUpdates)
		query =
			_id: lastUpdate._id
			project_id: ObjectId(project_id.toString())
			doc_id: ObjectId(doc_id.toString())
			pack: {$exists: true}
		update =
			$push:
				"pack": {$each: newUpdates}
			$inc:
				"n": n
				"sz":  sz
			$set:
				"meta.end_ts": last.meta.end_ts
				"v_end": last.v
		if lastUpdate.expiresAt and temporary
			update.$set.expiresAt = new Date(Date.now() + 7 * DAYS)
		logger.log {project_id, doc_id, lastUpdate, newUpdates}, "appending updates to existing pack"
		db.docHistory.findAndModify {query, update}, callback

	listDocs: (options, callback) ->
		query = {"op.p":{$exists:true}}
		query.doc_id = {$gt: ObjectId(options.doc_id)} if options.doc_id?
		db.docHistory.find(query, {doc_id:true}).sort({doc_id:1}).limit (options.limit||100), (err, docs) ->
			return callback(err) if err?
			callback(null, docs)
