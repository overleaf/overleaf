Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
logger.initialize("history")

HttpController = require "./app/js/HttpController"
express = require "express"
app = express()

app.post "/doc/:doc_id/flush", HttpController.flushUpdatesWithLock

app.use (error, req, res, next) ->
	logger.error err: error, "an internal error occured"
	req.send 500

port = Settings.internal?.history?.port or 3014
host = Settings.internal?.history?.host or "localhost"
app.listen port, host, (error) ->
	if error?
		logger.error err: error, "could not start history server"
	else
		logger.log "history api listening on http://#{host}:#{port}"

