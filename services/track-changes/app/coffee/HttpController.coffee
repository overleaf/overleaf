HistoryManager = require "./HistoryManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	appendUpdates: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		docOps  = req.body.docOps
		version = req.body.version
		logger.log doc_id: doc_id, version: version, "compressing doc history"
		HistoryManager.compressAndSaveRawUpdates doc_id, docOps, (error) ->
			return next(error) if error?
			res.send 204
