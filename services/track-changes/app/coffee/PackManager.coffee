async = require "async"
_ = require "underscore"
{db, ObjectId, BSON} = require "./mongojs"
logger = require "logger-sharelatex"
LockManager = require "./LockManager"
MongoAWS = require "./MongoAWS"
ProjectIterator = require "./ProjectIterator"

# Sharejs operations are stored in a 'pack' object
#
#  e.g.  a single sharejs update looks like
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
#     "v_end" : ...
#   }
#
#  where U1, U2, U3, .... are single updates stripped of their
#  doc_id and project_id fields (which are the same for all the
#  updates in the pack).
#
#  The pack itself has v and meta fields, this makes it possible to
#  treat packs and single updates in a similar way.
#
#  The v field of the pack itself is from the first entry U1, the
#  v_end field from UN.  The meta.end_ts field of the pack itself is
#  from the last entry UN, the meta.start_ts field from U1.

DAYS = 24 * 3600 * 1000 # one day in milliseconds

module.exports = PackManager =

	MAX_SIZE:  1024*1024 # make these configurable parameters
	MAX_COUNT: 1024

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
			temporary: temporary
		if temporary
			newPack.expiresAt = new Date(Date.now() + 7 * DAYS)
		logger.log {project_id, doc_id, newUpdates}, "inserting updates into new pack"
		db.docHistory.save newPack, (err, result) ->
			return callback(err) if err?
			if temporary
				return callback()
			else
				PackManager.updateIndex project_id, doc_id, callback

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
		db.docHistory.findAndModify {query, update,	new:true, fields:{meta:1,v_end:1}}, callback

	# Retrieve all changes for a document

	getOpsByVersionRange: (project_id, doc_id, fromVersion, toVersion, callback = (error, updates) ->) ->
		PackManager.loadPacksByVersionRange project_id, doc_id, fromVersion, toVersion, (error) ->
			query = {doc_id:ObjectId(doc_id.toString())}
			query.v = {$lte:toVersion} if toVersion?
			query.v_end = {$gte:fromVersion} if fromVersion?
			#console.log "query:", query
			db.docHistory.find(query).sort {v:-1}, (err, result) ->
				return callback(err) if err?
				#console.log "getOpsByVersionRange:", err, result
				updates = []
				opInRange = (op, from, to) ->
					return false if fromVersion? and op.v < fromVersion
					return false if toVersion? and op.v > toVersion
					return true
				for docHistory in result
					#console.log 'adding', docHistory.pack
					for op in docHistory.pack.reverse() when opInRange(op, fromVersion, toVersion)
						op.project_id = docHistory.project_id
						op.doc_id = docHistory.doc_id
						#console.log "added op", op.v, fromVersion, toVersion
						updates.push op
				callback(null, updates)

	loadPacksByVersionRange: (project_id, doc_id, fromVersion, toVersion, callback) ->
		PackManager.getIndex doc_id, (err, indexResult) ->
			return callback(err) if err?
			indexPacks = indexResult?.packs or []
			packInRange = (pack, from, to) ->
				return false if fromVersion? and pack.v_end < fromVersion
				return false if toVersion? and pack.v > toVersion
				return true
			neededIds = (pack._id for pack in indexPacks when packInRange(pack, fromVersion, toVersion))
			if neededIds.length
				PackManager.fetchPacksIfNeeded project_id, doc_id, neededIds, callback
			else
				callback()

	fetchPacksIfNeeded: (project_id, doc_id, pack_ids, callback) ->
		db.docHistory.find {_id: {$in: (ObjectId(id) for id in pack_ids)}}, {_id:1}, (err, loadedPacks) ->
			return callback(err) if err?
			allPackIds = (id.toString() for id in pack_ids)
			loadedPackIds = (pack._id.toString() for pack in loadedPacks)
			packIdsToFetch = _.difference allPackIds, loadedPackIds
			logger.log {project_id, doc_id, loadedPackIds, allPackIds, packIdsToFetch}, "analysed packs"
			return callback() if packIdsToFetch.length is 0
			async.eachLimit packIdsToFetch, 4, (pack_id, cb) ->
				MongoAWS.unArchivePack project_id, doc_id, pack_id, cb
			, (err) ->
				return callback(err) if err?
				logger.log {project_id, doc_id}, "done unarchiving"
				callback()

	# Retrieve all changes across a project

	makeProjectIterator: (project_id, before, callback) ->
		# get all the docHistory Entries
		db.docHistory.find({project_id: ObjectId(project_id)},{pack:false}).sort {"meta.end_ts":-1}, (err, packs) ->
			return callback(err) if err?
			allPacks = []
			seenIds = {}
			for pack in packs
				allPacks.push pack
				seenIds[pack._id] = true
			db.docHistoryIndex.find {project_id: ObjectId(project_id)}, (err, indexes) ->
				return callback(err) if err?
				for index in indexes
					for pack in index.packs when not seenIds[pack._id]
						pack.project_id = index.project_id
						pack.doc_id = index._id
						pack.fromIndex = true
						allPacks.push pack
						seenIds[pack._id] = true
				callback(null, new ProjectIterator(allPacks, before, PackManager.getPackById))

	getPackById: (project_id, doc_id, pack_id, callback) ->
		db.docHistory.findOne {_id: pack_id}, (err, pack) ->
			return callback(err) if err?
			if not pack?
				MongoAWS.unArchivePack project_id, doc_id, pack_id, callback
			else if pack.expiresAt? and not pack.temporary and false # TODO: remove false, temporarily disabled
				# we only need to touch the TTL on the listing of changes in the project
				# because diffs on individual documents are always done after that
				PackManager.increaseTTL pack, callback
				# only do this for cached packs, not temporary ones to avoid older packs
				# being kept longer than newer ones (which messes up the last update version)
			else
				callback(null, pack)

	increaseTTL: (pack, callback) ->
		if pack.expiresAt < new Date(Date.now() + 6 * DAYS)
			# update cache expiry since we are using this pack
			db.docHistory.findAndModify {
				query: {_id: pack._id}
				update: {$set: {expiresAt: new Date(Date.now() + 7 * DAYS)}}
			}, (err) ->
				return callback(err, pack)
		else
			callback(null, pack)

	# Manage docHistoryIndex collection

	getIndex: (doc_id, callback) ->
		db.docHistoryIndex.findOne {_id:ObjectId(doc_id.toString())}, callback

	getPackFromIndex: (doc_id, pack_id, callback) ->
		db.docHistoryIndex.findOne {_id:ObjectId(doc_id.toString()), "packs._id": pack_id}, {"packs.$":1}, callback

	getLastPackFromIndex: (doc_id, callback) ->
		db.docHistoryIndex.findOne {_id: ObjectId(doc_id.toString())}, {packs:{$slice:-1}}, (err, indexPack) ->
			return callback(err) if err?
			return callback() if not indexPack?
			callback(null,indexPack[0])

	getIndexWithKeys: (doc_id, callback) ->
		PackManager.getIndex doc_id, (err, index) ->
			return callback(err) if err?
			return callback() if not index?
			for pack in index?.packs or []
				index[pack._id] = pack
			callback(null, index)

	initialiseIndex: (project_id, doc_id, callback) ->
		PackManager.findCompletedPacks project_id, doc_id, (err, packs) ->
			#console.log 'err', err, 'packs', packs, packs?.length
			return callback(err) if err?
			return callback() if not packs?
			PackManager.insertPacksIntoIndexWithLock project_id, doc_id, packs, callback

	updateIndex: (project_id, doc_id, callback) ->
		# find all packs prior to current pack
		PackManager.findUnindexedPacks project_id, doc_id, (err, newPacks) ->
			return callback(err) if err?
			return callback() if not newPacks?
			PackManager.insertPacksIntoIndexWithLock project_id, doc_id, newPacks, (err) ->
				return callback(err) if err?
				logger.log {project_id, doc_id, newPacks}, "added new packs to index"
				callback()

	findCompletedPacks: (project_id, doc_id, callback) ->
		query = { doc_id: ObjectId(doc_id.toString()), expiresAt: {$exists:false} }
		db.docHistory.find(query, {pack:false}).sort {v:1}, (err, packs) ->
			return callback(err) if err?
			return callback() if not packs?
			return callback() if packs?.length <= 1
			packs.pop()  #  discard the last pack, it's still in progress
			callback(null, packs)

	# findPacks: (project_id, doc_id, queryFilter, callback) ->
	# 	query = { doc_id: ObjectId(doc_id.toString()) }
	# 	query = _.defaults query, queryFilter if queryFilter?
	# 	db.docHistory.find(query, {pack:false}).sort {v:1}, callback

	findUnindexedPacks: (project_id, doc_id, callback) ->
		PackManager.getIndexWithKeys doc_id, (err, indexResult) ->
			return callback(err) if err?
			PackManager.findCompletedPacks project_id, doc_id, (err, historyPacks) ->
				return callback(err) if err?
				return callback() if not historyPacks?
				# select only the new packs not already in the index
				newPacks = (pack for pack in historyPacks when not indexResult?[pack._id]?)
				newPacks = (_.omit(pack, 'doc_id', 'project_id', 'n', 'sz') for pack in newPacks)
				logger.log {project_id, doc_id, n: newPacks.length}, "found new packs"
				callback(null, newPacks)

	insertPacksIntoIndexWithLock: (project_id, doc_id, newPacks, callback) ->
		LockManager.runWithLock(
			"HistoryIndexLock:#{doc_id}",
			(releaseLock) ->
				PackManager._insertPacksIntoIndex project_id, doc_id, newPacks, releaseLock
			callback
		)

	_insertPacksIntoIndex: (project_id, doc_id, newPacks, callback) ->
		db.docHistoryIndex.findAndModify {
			query: {_id:ObjectId(doc_id.toString())}
			update:
				$setOnInsert: project_id: ObjectId(project_id.toString())
				$push:
					packs: {$each: newPacks, $sort: {v: 1}}
			upsert: true
		}, callback

	# Archiving packs to S3

	archivePack: (project_id, doc_id, pack_id, callback) ->
		clearFlagOnError = (err, cb) ->
			if err? # clear the inS3 flag on error
				PackManager.clearPackAsArchiveInProgress project_id, doc_id, pack_id, (err2) ->
					return cb(err2) if err2?
					return cb(err)
			else
				cb()
		async.series [
			(cb) ->
				PackManager.checkArchiveNotInProgress project_id, doc_id, pack_id, cb
			(cb) ->
				PackManager.markPackAsArchiveInProgress project_id, doc_id, pack_id, cb
			(cb) ->
				MongoAWS.archivePack project_id, doc_id, pack_id, (err) ->
					clearFlagOnError(err, cb)
			(cb) ->
				PackManager.checkArchivedPack project_id, doc_id, pack_id, (err) ->
					clearFlagOnError(err, cb)
			(cb) ->
				PackManager.markPackAsArchived project_id, doc_id, pack_id, cb
			(cb) ->
				PackManager.setTTLOnArchivedPack project_id, doc_id, pack_id, callback
		], callback


	checkArchivedPack: (project_id, doc_id, pack_id, callback) ->
		db.docHistory.findOne {_id: pack_id}, (err, pack) ->
			return callback(err) if err?
			return callback new Error("pack not found") if not pack?
			MongoAWS.readArchivedPack project_id, doc_id, pack_id, (err, result) ->
				delete result.last_checked
				delete pack.last_checked
				# need to compare ids as ObjectIds with .equals()
				for key in ['_id', 'project_id', 'doc_id']
					result[key] = pack[key] if result[key].equals(pack[key])
				for op, i in result.pack
					op._id = pack.pack[i]._id if op._id? and op._id.equals(pack.pack[i]._id)
				if _.isEqual pack, result
					callback()
				else
					logger.err {pack, result, jsondiff: JSON.stringify(pack) is JSON.stringify(result)}, "difference when comparing packs"
					callback new Error("pack retrieved from s3 does not match pack in mongo")
	# Extra methods to test archive/unarchive for a doc_id

	pushOldPacks: (project_id, doc_id, callback) ->
		PackManager.findCompletedPacks project_id, doc_id, (err, packs) ->
			return callback(err) if err?
			return callback() if not packs?.length
			PackManager.processOldPack project_id, doc_id, packs[0]._id, callback

	pullOldPacks: (project_id, doc_id, callback) ->
		PackManager.loadPacksByVersionRange project_id, doc_id, null, null, callback


	# Processing old packs via worker

	processOldPack: (project_id, doc_id, pack_id, callback) ->
		markAsChecked = (err) ->
			PackManager.markPackAsChecked project_id, doc_id, pack_id, (err2) ->
				return callback(err2) if err2?
				callback(err)
		logger.log {project_id, doc_id}, "processing old packs"
		db.docHistory.findOne {_id:pack_id}, (err, pack) ->
			return markAsChecked(err) if err?
			return markAsChecked() if not pack?
			return callback() if pack.expiresAt? # return directly
			PackManager.updateIndexIfNeeded project_id, doc_id, (err) ->
				return markAsChecked(err) if err?
				PackManager.findUnarchivedPacks project_id, doc_id, (err, unarchivedPacks) ->
					return markAsChecked(err) if err?
					if not unarchivedPacks?.length
						logger.log "no packs need archiving"
						return markAsChecked()
					async.eachSeries unarchivedPacks, (pack, cb) ->
						PackManager.archivePack project_id, doc_id, pack._id, cb
					, (err) ->
						return markAsChecked(err) if err?
						logger.log "done processing"
						markAsChecked()

	updateIndexIfNeeded: (project_id, doc_id, callback) ->
		logger.log {project_id, doc_id}, "archiving old packs"
		PackManager.getIndexWithKeys doc_id, (err, index) ->
			return callback(err) if err?
			if not index?
				PackManager.initialiseIndex project_id, doc_id, callback
			else
				PackManager.updateIndex project_id, doc_id, callback

	markPackAsChecked: (project_id, doc_id, pack_id, callback) ->
		logger.log {project_id, doc_id, pack_id}, "marking pack as checked"
		db.docHistory.findAndModify {
			query: {_id: pack_id}
			update: {$currentDate: {"last_checked":true}}
		}, callback

	findUnarchivedPacks: (project_id, doc_id, callback) ->
		PackManager.getIndex doc_id, (err, indexResult) ->
			return callback(err) if err?
			indexPacks = indexResult?.packs or []
			unArchivedPacks = (pack for pack in indexPacks when not pack.inS3?)
			logger.log {project_id, doc_id, n: unArchivedPacks.length}, "find unarchived packs"
			callback(null, unArchivedPacks)

	# Archive locking flags

	checkArchiveNotInProgress: (project_id, doc_id, pack_id, callback) ->
		logger.log {project_id, doc_id, pack_id}, "checking if archive in progress"
		PackManager.getPackFromIndex doc_id, pack_id, (err, result) ->
			return callback(err) if err?
			return callback new Error("pack not found in index") if not result?
			if result.inS3
				return callback new Error("pack archiving already done")
			else if result.inS3?
				return callback new Error("pack archiving already in progress")
			else
				return callback()

	markPackAsArchiveInProgress: (project_id, doc_id, pack_id, callback) ->
		logger.log {project_id, doc_id}, "marking pack as archive in progress status"
		db.docHistoryIndex.findAndModify {
			query: {_id:ObjectId(doc_id.toString()),  packs: {$elemMatch: {"_id": pack_id, inS3: {$exists:false}}}}
			fields:  { "packs.$": 1 }
			update: {$set: {"packs.$.inS3":false}}
		}, (err, result) ->
			return callback(err) if err?
			return callback new Error("archive is already in progress") if not result?
			logger.log {project_id, doc_id, pack_id}, "marked as archive in progress"
			callback()

	clearPackAsArchiveInProgress: (project_id, doc_id, pack_id, callback) ->
		logger.log {project_id, doc_id, pack_id}, "clearing as archive in progress"
		db.docHistoryIndex.findAndModify {
			query: {_id:ObjectId(doc_id.toString()), "packs" : {$elemMatch: {"_id": pack_id, inS3: false}}}
			fields:  { "packs.$": 1 }
			update: {$unset: {"packs.$.inS3":true}}
		}, callback

	markPackAsArchived: (project_id, doc_id, pack_id, callback) ->
		logger.log {project_id, doc_id, pack_id}, "marking pack as archived"
		db.docHistoryIndex.findAndModify {
			query: {_id:ObjectId(doc_id.toString()), "packs" : {$elemMatch: {"_id": pack_id, inS3: false}}}
			fields: { "packs.$": 1 }
			update: {$set: {"packs.$.inS3":true}}
		}, (err, result) ->
			return callback(err) if err?
			return callback new Error("archive is not marked as progress") if not result?
			logger.log {project_id, doc_id, pack_id}, "marked as archived"
			callback()

	setTTLOnArchivedPack: (project_id, doc_id, pack_id, callback) ->
		db.docHistory.findAndModify {
			query: {_id: pack_id}
			update: {$set: {expiresAt: new Date(Date.now() + 1*DAYS)}}
		}, (err) ->
			logger.log {project_id, doc_id, pack_id}, "set expiry on pack"
			callback()
