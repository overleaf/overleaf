express = require "express"
app = express()

ConversoinManager = require "./app/js/ConversionManager"
logger = require "logger-sharelatex"
logger.initialize("history")

app.post express.bodyParser(), "/doc/:doc_id/flush", (req, res, next) ->
	project_id = req.params.project_id
	docOps = req.body.docOps
	logger.log doc_id: doc_id, "compressing doc history"
	ConversionManager.convertAndSaveRawOps doc_id, docOps, (error) ->
		return next(error) if error?
		res.send 204 # No content

app.use (error, req, res, next) ->
	logger.error err: error, "an internal error occured"
	req.send 500

app.listen(3014)
