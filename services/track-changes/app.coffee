Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
logger.initialize("track-changes")

require("./app/js/MongoManager").ensureIndices()

HttpController = require "./app/js/HttpController"
express = require "express"
app = express()

app.use express.logger()

app.post "/doc/:doc_id/flush", HttpController.flushUpdatesWithLock

app.get "/project/:project_id/doc/:doc_id/diff", HttpController.getDiff

app.get "/status", (req, res, next) ->
	res.send "track-changes is alive"

app.use (error, req, res, next) ->
	logger.error err: error, "an internal error occured"
	res.send 500

port = Settings.internal?.trackchanges?.port or 3015
host = Settings.internal?.trackchanges?.host or "localhost"
app.listen port, host, (error) ->
	if error?
		logger.error err: error, "could not start track-changes server"
	else
		logger.log "track changes api listening on http://#{host}:#{port}"

