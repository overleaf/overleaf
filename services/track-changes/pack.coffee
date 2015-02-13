mongojs = require "mongojs"
async = require "async"
db = mongojs.connect("localhost/sharelatex", ["docHistory"])
BSON=db.bson.BSON
util = require 'util'
_ = require 'underscore'
MAX_SIZE = 1024*1024
MAX_COUNT = 1024

packOps = (doc_id, callback) ->
	console.log 'packing', doc_id
	db.docHistory.find({doc_id:mongojs.ObjectId(doc_id),pack:{$exists:false}}).sort {v:1}, (err, docs) ->
		packs = []
		top = null
		if docs.length < 100
			console.log 'only', docs.length, 'ops, skipping'
			return
		docs.forEach (d,i) ->
			sz = BSON.calculateObjectSize(d)
			if top?	&& top.pack.length < MAX_COUNT && top.sz + sz < MAX_SIZE
				top.pack = top.pack.concat {v: d.v, meta: d.meta,  op: d.op, _id: d._id}
				top.sz += sz
				top.v_end = d.v
				top.meta.end_ts = d.meta.end_ts
				return
			else
				# create a new pack
				top = _.clone(d)
				top.pack = [ {v: d.v, meta: d.meta,  op: d.op, _id: d._id} ]
				top.meta = { start_ts: d.meta.start_ts, end_ts: d.meta.end_ts }
				top.sz = sz
				delete top.op
				delete top._id
				packs.push top
		# never store the last pack, keep some unpacked ops
		packs.pop()
		#
		if packs.length > docs.length
			console.log 'not enough compression', packs.length, 'vs', docs.length, 'skipping'
			return

		console.log 'docs', docs.length, 'packs', packs.length
		tasks = []
		for pack, i in packs
			console.log 'storing pack', i
			do (pack) ->
				task = (cb) ->
					bulk = db.docHistory.initializeOrderedBulkOp();
					console.log 'insert', pack
					bulk.insert pack
					pack.pack.forEach (op) ->
						console.log 'will remove', op._id
						bulk.find({_id:op._id}).removeOne()
					bulk.execute (err, result) ->
						console.log 'ok?', result.ok, 'nInserted', result.nInserted, 'nRemoved', result.nRemoved
						cb(err, result)
				tasks.push task

		async.series tasks, (err, result) ->
			console.log 'writing packs', err, result.length
			callback err, result

packOpsTask = (doc_id) ->
	return (callback) ->
		packOps doc_id, callback

tasks = (packOpsTask id for id in process.argv.slice(2))

async.series tasks, (err, results) ->
	console.log 'closing db'
	#console.log util.inspect(results,{depth:null})
	db.close()
