async = require "async"
_ = require "underscore"
{db, ObjectId, BSON} = require "./mongojs"
logger = require "logger-sharelatex"
logger.initialize("track-changes-packworker")
LockManager = require "./LockManager"
PackManager = require "./PackManager"

# this worker script is forked by the main process to look for
# document histories which can be packed

LIMIT = Number(process.argv[2]) || 1000
DOCUMENT_PACK_DELAY = Number(process.argv[3]) || 1000
TIMEOUT = Number(process.argv[4]) || 30*60*1000

shutDownRequested = false
setTimeout () ->
	logger.log "pack timed out, requesting shutdown"
	# start the shutdown on the next pack
	shutDownRequested = true
	# do a hard shutdown after a further 5 minutes
	setTimeout () ->
		logger.error "HARD TIMEOUT in pack worker"
		process.exit()
	, 5*60*1000
, TIMEOUT

logger.log "checking for updates, limit=#{LIMIT}, delay=#{DOCUMENT_PACK_DELAY}, timeout=#{TIMEOUT}"

# work around for https://github.com/mafintosh/mongojs/issues/224
db.close =  (callback) ->
	this._getServer (err, server) ->
		return callback(err) if err?
		server = if server.destroy? then server else server.topology
		server.destroy(true, true)
		callback()

finish = () ->
	logger.log 'closing db'
	db.close () ->
		logger.log 'exiting from pack worker'
		process.exit()

processUpdates = (pending) ->
	async.eachSeries pending,	(doc_id, callback) ->
		PackManager.packDocHistory doc_id, (err, result) ->
			if err?
				logger.error {err, result}, "error in pack worker"
				return callback(err)
			if shutDownRequested
				logger.error "shutting down pack worker"
				return callback(new Error("shutdown"))
			setTimeout () ->
				callback(err, result)
			, DOCUMENT_PACK_DELAY
	, (err, results) ->
		if err? and err.message != "shutdown"
			logger.error {err}, 'error in pack worker processUpdates'
		finish()

# find the documents which can be packed, by checking the number of
# unpacked updates in the docHistoryStats collection

db.docHistoryStats.find({
	update_count: {$gt : PackManager.MIN_COUNT}
}).sort({
	update_count:-1
}).limit LIMIT, (err, results) ->
	if err?
		logger.log {err}, 'error checking for updates'
		finish()
		return
	results = _.filter results, (doc) ->
		if doc.last_checked? and doc.last_checked > doc.last_update
			# skip documents which don't have any updates since last check
			return false
		else if doc.last_packed? and doc.last_packed > doc.last_update
			# skip documents which don't have any updates since last pack
			return false
		else
			return true
	pending = _.pluck results, 'doc_id'
	logger.log "found #{pending.length} documents to pack"
	processUpdates pending
