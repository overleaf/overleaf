mongojs = require "mongojs"
async = require "async"
db = mongojs.connect("localhost/sharelatex", ["docHistory"])
BSON=db.bson.BSON
util = require 'util'
_ = require 'underscore'
MAX_SIZE = 1024*1024
MAX_COUNT = 1024
MIN_COUNT = 100
KEEP_OPS = 100

insertPack = (packObj, callback) ->
	bulk = db.docHistory.initializeOrderedBulkOp();
	expect_nInserted = 1
	expect_nRemoved = packObj.pack.length
	console.log 'inserting', expect_nInserted, 'pack, will remove', expect_nRemoved, 'ops'
	bulk.insert packObj
	packObj.pack.forEach (op) ->
		bulk.find({_id:op._id}).removeOne()
	bulk.execute (err, result) ->
		if err? or result.nInserted != expect_nInserted or result.nRemoved != expect_nRemoved
			console.log err, result
			console.log 'nInserted', result.nInserted, 'nRemoved', result.nRemoved
		callback(err, result)

packDocHistory = (doc_id, callback) ->
	console.log 'packing doc_id', doc_id
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
				console.log 'keeping large op unchanged'

		# only store packs with a sufficient number of ops, discard others
		packs = packs.filter (packObj) ->
			packObj.pack.length > MIN_COUNT

		console.log 'docs', origDocs, 'packs', packs.length
		async.each packs, insertPack, (err, result) ->
			if err?
				console.log 'err', err
			console.log 'done writing packs'
			callback err, result

async.each process.argv.slice(2),	(doc_id, callback) ->
		packDocHistory(doc_id, callback)
	, (err, results) ->
		console.log 'closing db'
		db.close()
