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

MAX_SIZE = 1024*1024
MAX_COUNT = 1024
MIN_COUNT = 100
KEEP_OPS = 100

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
		callback(err, result)

packDocHistory = (doc_id, callback) ->
	util.log "starting pack operation for #{doc_id}"
	db.docHistory.find({doc_id:mongojs.ObjectId(doc_id),pack:{$exists:false}}).sort {v:1}, (err, docs) ->
		packs = []
		top = null
		origDocs = docs.length
		# keep the last KEEP_OPS as individual ops
		docs = docs.slice(0,-KEEP_OPS)
		docs.forEach (d,i) ->
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
				util.log 'keeping large op unchanged (#{sz} bytes)'

		# only store packs with a sufficient number of ops, discard others
		packs = packs.filter (packObj) ->
			packObj.pack.length > MIN_COUNT

		util.log "docs #{origDocs} packs #{packs.length}"
		if packs.length
			async.eachSeries packs, insertPack, (err, result) ->
				if err?
					console.log doc_id, err
				else
					util.log "done writing packs"
				callback err, result
		else
			util.log "no packs to write"
			callback null, null

readFile = (file, callback) ->
	ids = []
	lineReader.eachLine file, (line) ->
		result = line.match(/[0-9a-f]{24}/)
		if result?
			ids.push result[0]
	.then () ->
		callback(null, ids)

todoFile = process.argv[2]
doneFile = process.argv[3]
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
				else
					fs.appendFileSync doneFile, doc_id + '\n'
				if shutdownRequested
					return callback('shutdown')
				setTimeout () ->
					callback(err, result)
				, 1000
		, (err, results) ->
			if err?
				console.log 'error:', err
			util.log 'closing db'
			db.close()
