Settings = require "settings-sharelatex"
async = require "async"
_ = require "underscore"
{db, ObjectId, BSON} = require "./mongojs"
logger = require "logger-sharelatex"
logger.initialize("track-changes-packworker")
if Settings.sentry?.dsn?
	logger.initializeErrorReporting(Settings.sentry.dsn)

DAYS = 24 * 3600 * 1000

LockManager = require "./LockManager"
PackManager = require "./PackManager"

# this worker script is forked by the main process to look for
# document histories which can be archived

LIMIT = Number(process.argv[2]) || 1000
DOCUMENT_PACK_DELAY = Number(process.argv[3]) || 1000
TIMEOUT = Number(process.argv[4]) || 30*60*1000

shutDownRequested = false
shutDownTimer = setTimeout () ->
	logger.log "pack timed out, requesting shutdown"
	# start the shutdown on the next pack
	shutDownRequested = true
	# do a hard shutdown after a further 5 minutes
	setTimeout () ->
		logger.error "HARD TIMEOUT in pack archive worker"
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
	if shutDownTimer?
		logger.log 'cancelling timeout'
		clearTimeout shutDownTimer
	logger.log 'closing db'
	db.close () ->
		logger.log 'closing LockManager Redis Connection'
		LockManager.close () ->
			logger.log 'ready to exit from pack archive worker'
			hardTimeout = setTimeout () ->
				logger.error 'hard exit from pack archive worker'
				process.exit(1)
			, 5*1000
			hardTimeout.unref()

process.on 'exit', (code) ->
	logger.log {code}, 'pack archive worker exited'

processUpdates = (pending) ->
	async.eachSeries pending,	(result, callback) ->
		{_id, project_id, doc_id} = result
		if not project_id? or not doc_id?
			logger.log {project_id, doc_id}, "skipping pack, missing project/doc id"
			return callback()
		PackManager.processOldPack project_id, doc_id, _id, (err, result) ->
			if err?
				logger.error {err, result}, "error in pack archive worker"
				return callback(err)
			if shutDownRequested
				logger.error "shutting down pack archive worker"
				return callback(new Error("shutdown"))
			setTimeout () ->
				callback(err, result)
			, DOCUMENT_PACK_DELAY
	, (err, results) ->
		if err? and err.message != "shutdown"
			logger.error {err}, 'error in pack archive worker processUpdates'
		finish()

# find the packs which can be archived

ObjectIdFromDate =  (date) ->
	id = Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000";
	return ObjectId(id)

# new approach, two passes
# find packs to be marked as finalised:true, those which have a newer pack present
# then only consider finalised:true packs for archiving

db.docHistory.find({
	expiresAt: {$exists: false}
	project_id: {$exists: true}
	v_end: {$exists: true}
	_id: {$lt: ObjectIdFromDate(new Date(Date.now() - 7 * DAYS))}
}, {_id:1, doc_id:1, project_id:1}).sort({
	last_checked:1
}).limit LIMIT, (err, results) ->
	if err?
		logger.log {err}, 'error checking for updates'
		finish()
		return
	pending = _.uniq results, false, (result) -> result.doc_id.toString()
	logger.log "found #{pending.length} documents to archive"
	processUpdates pending
