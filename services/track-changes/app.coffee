express = require "express"
app = express()

ConversoinManager = require "./app/js/ConversionManager"
logger = require "logger-sharelatex"
logger.initialize("history")

app.post "/doc/:doc_id/flush", (req, res, next) ->
	project_id = req.params.project_id
	logger.log doc_id: doc_id, "compressing doc history"
	ConversionManager.convertOldRawUpdates doc_id, (error) ->
		return next(error) if error?
		res.send 204 # No content

app.use (error, req, res, next) ->
	logger.error err: error, "an internal error occured"
	req.send 500

app.listen(3014)
