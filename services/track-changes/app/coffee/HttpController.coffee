HistoryManager = require "./HistoryManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	flushUpdatesWithLock: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		logger.log doc_id: doc_id, "compressing doc history"
		HistoryManager.processUncompressedUpdatesWithLock doc_id, (error) ->
			return next(error) if error?
			logger.log "done http request"
			res.send 204
