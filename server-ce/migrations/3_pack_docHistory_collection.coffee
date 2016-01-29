Settings = require "settings-sharelatex"
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['docs','docHistory', 'docHistoryStats'])
_ = require("lodash")
async = require("async")
exec = require("child_process").exec
BSON = db.bson.BSON

logger = {
	log: ->
	err: ->
}

finished_docs_path = "/tmp/finished-docs-3"
all_docs_path = "/tmp/all-docs-3"
unmigrated_docs_path = "/tmp/unmigrated-docs-3"

finished_docs = {}
if fs.existsSync(finished_docs_path)
	for id in fs.readFileSync(finished_docs_path,'utf-8').split("\n")
		finished_docs[id] = true

getAndWriteDocids = (callback)->
	console.log "finding all doc id's - #{new Date().toString()}"
	db.docs.find {}, {_id:1}, (err, ids)->
		console.log "total found docs in mongo #{ids.length} - #{new Date().toString()}"
		ids = _.pluck ids, '_id'
		ids = _.filter ids, (id)-> id?
		fileData = ids.join("\n")
		fs.writeFileSync all_docs_path + ".tmp", fileData
		fs.renameSync all_docs_path + ".tmp", all_docs_path
		callback(err, ids)

loadDocIds = (callback)->
	console.log "loading doc ids from #{all_docs_path}"
	data = fs.readFileSync all_docs_path, "utf-8"
	ids = data.split("\n")
	console.log "loaded #{ids.length} doc ids from #{all_docs_path}"
	callback null, ids

getDocIds = (callback)->
	exists = fs.existsSync all_docs_path
	if exists
		loadDocIds callback
	else
		getAndWriteDocids callback

markDocAsProcessed = (doc_id, callback)->
	finished_docs[doc_id] = true
	fs.appendFile finished_docs_path, "#{doc_id}\n", callback

markDocAsUnmigrated = (doc_id, callback)->
	console.log "#{doc_id} unmigrated"
	markDocAsProcessed doc_id, (err)->
		fs.appendFile unmigrated_docs_path, "#{doc_id}\n", callback

printProgress = ->
	count = Object.keys(finished_docs).length
	console.log "completed", count

checkIfDocHasBeenProccessed = (doc_id, callback)->
	callback(null, finished_docs[doc_id])

processNext = (doc_id, callback)->
	if !doc_id? or doc_id.length == 0
		return callback()
	checkIfDocHasBeenProccessed doc_id, (err, hasBeenProcessed)->
		if hasBeenProcessed
			console.log "#{doc_id} already processed, skipping"
			return callback()
		console.log "#{doc_id} processing"
		PackManager._packDocHistory doc_id, {}, (err) ->
			markDocAsProcessed doc_id, callback

exports.migrate = (client, done = ->)->
	getDocIds (err, ids)->
		interval = setInterval printProgress, 3*1000
		jobs = _.map ids, (id)->
			return (cb)->
				processNext(id, cb)
		async.series jobs, (err)->
			if err?
				console.error err, "at end of jobs"
			else
				console.log "finished"
			clearInterval interval
			done(err)

exports.rollback = (client, done)->
	done()

DAYS = 24 * 3600 * 1000 # one day in milliseconds

# copied from track-changes/app/coffee/PackManager.coffee

PackManager =
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
			sz = BSON.calculateObjectSize(d)
			# decide if this doc can be added to the current pack
			validLength = top? && (top.pack.length < PackManager.MAX_COUNT)
			validSize = top? && (top.sz + sz < PackManager.MAX_SIZE)
			bothPermanent = top? && (top.expiresAt? is false) && (d.expiresAt? is false)
			bothTemporary = top? && (top.expiresAt? is true) && (d.expiresAt? is true)
			within1Day = bothTemporary && (d.meta.start_ts - top.meta.start_ts < 24 * 3600 * 1000)
			if top? && validLength && validSize && (bothPermanent || (bothTemporary && within1Day))
				top.pack = top.pack.concat {v: d.v, meta: d.meta,  op: d.op, _id: d._id}
				top.sz += sz
				top.n += 1
				top.v_end = d.v
				top.meta.end_ts = d.meta.end_ts
				top.expiresAt = d.expiresAt if top.expiresAt?
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
