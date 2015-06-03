Settings = require "settings-sharelatex"
fs = require("fs")
{db, ObjectId} = require "./app/coffee/mongojs"
async = require("async")
BSON=db.bson.BSON
util = require 'util'
_ = require 'underscore'
PackManager = require "./app/coffee/PackManager.coffee"

lineReader = require "line-reader"
cli = require "cli"
options = cli.parse {
	'update': ['u', 'find documents to pack from database']
	'dry-run':   ['n', 'do not write to database'],
	'fast':  [false, 'no delays on writes']
}

DB_WRITE_DELAY = if options.fast then 0 else 2000
DOCUMENT_PACK_DELAY = if options.fast then 0 else 1000

packDocHistory = (doc_id, callback) ->
	util.log "starting pack operation for #{doc_id}"
	getDocHistory doc_id, (err, docs) ->
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
			util.log "docs #{origDocs} packs #{origPacks} => packs #{packs.length} of #{total} ops"
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
	db.docHistory.find({doc_id:ObjectId(doc_id)}).sort {v:1}, (err, docs) ->
		return callback(err) if err?
		# for safety, do a consistency check of the history
		util.log "checking history for #{doc_id}"
		PackManager.checkHistory docs, (err) ->
			return callback(err) if err?
			callback(err, docs)
			#PackManager.deleteExpiredPackOps docs, (err) ->
			#	return callback(err) if err?
			#	callback err, docs

safeInsert = (packObj, callback) ->
	if shutdownRequested
		return callback('shutdown')
	PackManager.insertPack packObj, (err, result) ->
		setTimeout () ->
			callback(err,result)
		, DB_WRITE_DELAY

savePacks = (packs, callback) ->
	async.eachSeries packs, safeInsert, (err, result) ->
		if err?
			util.log "error writing packs"
			callback err, result
		else
			util.log "done writing packs"
			callback()

readFile = (file, callback) ->
	ids = []
	lineReader.eachLine file, (line) ->
		result = line.match(/[0-9a-f]{24}/)
		if result?
			ids.push result[0]
	.then () ->
		callback(null, ids)

shutdownRequested = false
process.on  'SIGINT', () ->
	util.log "Gracefully shutting down from SIGINT"
	shutdownRequested = true

processUpdates = (pending) ->
	async.eachSeries pending,	(doc_id, callback) ->
		packDocHistory doc_id, (err, result) ->
			if err?
				console.log "ERROR:", err, result
				return callback(err)
			else if not options['dry-run'] && doneFile?
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

if options['update']
	util.log 'checking for updates'
	db.docHistoryStats.find({
		update_count: {$gt : PackManager.MIN_COUNT}
	}).sort({
		update_count:-1
	}).limit 1000, (error, results) ->
		if err?
			utils.log 'error', error
			db.close()
			return
		util.log "found #{results.length} documents to pack"
		pending = _.pluck results, 'doc_id'
		processUpdates pending
else
	todoFile = cli.args[1]
	doneFile = cli.args[2]
	util.log "reading from #{todoFile}"
	util.log "logging progress to #{doneFile}"
	fs.appendFileSync doneFile, '# starting pack run at ' + new Date() + '\n'

	readFile todoFile, (err, todo) ->
		readFile doneFile, (err, done) ->
			pending = _.difference todo, done
			processUpdates pending
