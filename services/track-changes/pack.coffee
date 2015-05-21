Settings = require "settings-sharelatex"
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['docHistory'])
async = require("async")
BSON=db.bson.BSON
util = require 'util'
_ = require 'underscore'

lineReader = require "line-reader"
cli = require "cli"
options = cli.parse {
	'dry-run':   ['n', 'do not write to database'],
	'fast':  [false, 'no delays on writes']
}

MAX_SIZE = 1024*1024
MAX_COUNT = 1024
MIN_COUNT = 100
KEEP_OPS = 100

DB_WRITE_DELAY = if options.fast then 0 else 2000
DOCUMENT_PACK_DELAY = if options.fast then 0 else 1000

packDocHistory = (doc_id, callback) ->
	util.log "starting pack operation for #{doc_id}"
	getDocHistory doc_id, (err, docs) ->
		return callback(err) if err?
		origDocs = docs.length
		convertDocsToPacks docs, (err, packs) ->
			return callback(err) if err?
			util.log "docs #{origDocs} packs #{packs.length}"
			if packs.length
				if options['dry-run']
					util.log 'dry-run, skipping write packs'
					return callback()
				savePacks packs, (err) ->
					return callback(err) if err?
					# check the history again
					getDocHistory doc_id, callback
			else
				util.log "no packs to write"
				callback null, null

# retrieve document ops/packs and check them
getDocHistory = (doc_id, callback) ->
	db.docHistory.find({doc_id:mongojs.ObjectId(doc_id)}).sort {v:1}, (err, docs) ->
		return callback(err) if err?
		# for safety, do a consistency check of the history
		checkHistory doc_id, docs, (err) ->
			return callback(err) if err?
			callback err, docs

convertDocsToPacks = (docs, callback) ->
	packs = []
	top = null
	# keep the last KEEP_OPS as individual ops
	docs = docs.slice(0,-KEEP_OPS)

	docs.forEach (d,i) ->
		if d.pack?
			util.log "skipping existing pack of #{d.pack.length}"
			top = null if top? # flush the current pack
			return # and try next
		sz = BSON.calculateObjectSize(d)
		if top?	&& top.pack.length < MAX_COUNT && top.sz + sz < MAX_SIZE
			top.pack = top.pack.concat {v: d.v, meta: d.meta,  op: d.op, _id: d._id}
			top.sz += sz
			top.v_end = d.v
			top.meta.end_ts = d.meta.end_ts
			return
		else if sz < MAX_SIZE
			# create a new pack
			top = _.clone(d)
			top.pack = [ {v: d.v, meta: d.meta,  op: d.op, _id: d._id} ]
			top.meta = { start_ts: d.meta.start_ts, end_ts: d.meta.end_ts }
			top.sz = sz
			delete top.op
			delete top._id
			packs.push top
		else
			# keep the op
			util.log "keeping large op unchanged (#{sz} bytes)"

	# only store packs with a sufficient number of ops, discard others
	packs = packs.filter (packObj) ->
		packObj.pack.length > MIN_COUNT
	callback(null, packs)

savePacks = (packs, callback) ->
	async.eachSeries packs, insertPack, (err, result) ->
		if err?
			console.log err
			callback err, result
		else
			util.log "done writing packs"
			callback()

insertPack = (packObj, callback) ->
	if shutdownRequested
		return callback('shutdown')
	bulk = db.docHistory.initializeOrderedBulkOp();
	expect_nInserted = 1
	expect_nRemoved = packObj.pack.length
	util.log "insert #{expect_nInserted} pack, remove #{expect_nRemoved} ops"
	bulk.insert packObj
	packObj.pack.forEach (op) ->
		bulk.find({_id:op._id}).removeOne()
	bulk.execute (err, result) ->
		if err? or result.nInserted != expect_nInserted or result.nRemoved != expect_nRemoved
			console.log err, result
			console.log 'nInserted', result.nInserted, 'nRemoved', result.nRemoved
		setTimeout () ->
			callback(err, result)
		, DB_WRITE_DELAY

checkHistory = (doc_id, docs, callback) ->
	util.log "checking history for #{doc_id}"
	errors = 0
	prev = null
	error = (args...) ->
		errors++
		console.log.apply(null, args)
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
		else
			prev = v
			v = d.v
			error('bad version', v, 'in', d) if v <= prev
	if errors
		callback({errcount: errors})
	else
		callback()

readFile = (file, callback) ->
	ids = []
	lineReader.eachLine file, (line) ->
		result = line.match(/[0-9a-f]{24}/)
		if result?
			ids.push result[0]
	.then () ->
		callback(null, ids)

todoFile = cli.args[1]
doneFile = cli.args[2]
util.log "reading from #{todoFile}"
util.log "logging progress to #{doneFile}"
fs.appendFileSync doneFile, '# starting pack run at ' + new Date() + '\n'

shutdownRequested = false
process.on  'SIGINT', () ->
	util.log "Gracefully shutting down from SIGINT"
	shutdownRequested = true

readFile todoFile, (err, todo) ->
	readFile doneFile, (err, done) ->
		pending = _.difference todo, done
		async.eachSeries pending,	(doc_id, callback) ->
			packDocHistory doc_id, (err, result) ->
				if err?
					return callback(err)
				else if not options['dry-run']
					fs.appendFileSync doneFile, doc_id + '\n'
				if shutdownRequested
					return callback('shutdown')
				setTimeout () ->
					callback(err, result)
				, DOCUMENT_PACK_DELAY
		, (err, results) ->
			if err?
				console.log 'error:', err
			util.log 'closing db'
			db.close()
