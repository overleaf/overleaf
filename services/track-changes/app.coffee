Settings = require "settings-sharelatex"
express = require "express"
app = express()

HistoryManager = require "./app/js/HistoryManager"
logger = require "logger-sharelatex"
logger.initialize("history")

app.post "/doc/:doc_id/history", express.bodyParser(), (req, res, next) ->
	doc_id = req.params.doc_id
	docOps  = req.body.docOps
	version = req.body.version
	logger.log doc_id: doc_id, version: version, "compressing doc history"
	HistoryManager.compressAndSaveRawUpdates doc_id, docOps, (error) ->
		return next(error) if error?
		res.send 204

app.use (error, req, res, next) ->
	logger.error err: error, "an internal error occured"
	req.send 500

app.listen (Settings.port ||= 3014), (error) ->
	if error?
		logger.error err: error, "could not start history server"
	logger.log "history api listening on port 3014"

