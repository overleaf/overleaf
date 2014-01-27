Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
logger.initialize("history")

HttpController = require "./app/js/HttpController"
express = require "express"
app = express()

app.post "/doc/:doc_id/history", express.bodyParser(), HttpController.appendUpdates

app.use (error, req, res, next) ->
	logger.error err: error, "an internal error occured"
	req.send 500

app.listen (Settings.port ||= 3014), (error) ->
	if error?
		logger.error err: error, "could not start history server"
	logger.log "history api listening on port 3014"

