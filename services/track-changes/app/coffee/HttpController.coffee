HistoryManager = require "./HistoryManager"
DiffManager = require "./DiffManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	flushUpdatesWithLock: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		logger.log doc_id: doc_id, "compressing doc history"
		HistoryManager.processUncompressedUpdatesWithLock doc_id, (error) ->
			return next(error) if error?
			res.send 204

	getDiff: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id

		if req.query.from?
			from = parseInt(req.query.from, 10)
		else
			from = null
		if req.query.to?
			to = parseInt(req.query.to, 10)
		else
			to = null

		logger.log project_id, doc_id: doc_id, from: from, to: to, "getting diff"
		DiffManager.getDiff project_id, doc_id, from, to, (error, diff) ->
			return next(error) if error?
			res.send JSON.stringify(diff: diff)

