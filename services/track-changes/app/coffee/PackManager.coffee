async = require "async"
_ = require "underscore"

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

			# now find any packs that overlap with the time window
			overlapQuery = _.clone(query)
			if before? && cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": before}
				overlapQuery['pack.0.meta.end_ts'] = {"$lte": before }
			else if before? && not cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": before}
				overlapQuery['pack.0.meta.end_ts'] = {"$lte": before }
			else if not before? && cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": cutoff}
				overlapQuery['pack.0.meta.end_ts'] = {"$gte": 0 }
			else if not before? && not cutoff?
				overlapQuery['meta.end_ts'] = {"$gte": 0 }
				overlapQuery['pack.0.meta.end_ts'] = {"$gte": 0 }
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
