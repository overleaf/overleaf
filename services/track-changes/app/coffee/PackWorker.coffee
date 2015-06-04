async = require "async"
_ = require "underscore"
{db, ObjectId} = require "./mongojs"
BSON=db.bson.BSON
logger = require "logger-sharelatex"
logger.initialize("track-changes-packworker")
LockManager = require "./LockManager"
PackManager = require "./PackManager"

# this worker script is forked by the main process to look for
# document histories which can be packed

DOCUMENT_PACK_DELAY = 1000

logger.log 'checking for updates'

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
			setTimeout () ->
				callback(err, result)
			, DOCUMENT_PACK_DELAY
	, (err, results) ->
		if err?
			logger.error {err}, 'error in pack worker processUpdates'
		finish()

# find the documents which can be packed, by checking the number of
# unpacked updates in the docHistoryStats collection

db.docHistoryStats.find({
	update_count: {$gt : PackManager.MIN_COUNT}
}).sort({
	update_count:-1
}).limit 1000, (err, results) ->
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
