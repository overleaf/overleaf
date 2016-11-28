settings = require "settings-sharelatex"
request  = require "request"
logger = require "logger-sharelatex"
async = require "async"
WebRedisManager = require "./WebRedisManager"

module.exports = HistoryManager =
	flushDocChanges: (project_id, doc_id, callback = (error) ->) ->
		if !settings.apis?.trackchanges?
			logger.warn doc_id: doc_id, "track changes API is not configured, so not flushing"
			return callback()

		url = "#{settings.apis.trackchanges.url}/project/#{project_id}/doc/#{doc_id}/flush"
		logger.log project_id: project_id, doc_id: doc_id, url: url, "flushing doc in track changes api"
		request.post url, (error, res, body)->
			if error?
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				return callback(null)
			else
				error = new Error("track changes api returned a failure status code: #{res.statusCode}")
				return callback(error)

	FLUSH_EVERY_N_OPS: 50
	pushUncompressedHistoryOps: (project_id, doc_id, ops = [], callback = (error) ->) ->
		if ops.length == 0
			return callback()
		WebRedisManager.pushUncompressedHistoryOps project_id, doc_id, ops, (error, length) ->
			return callback(error) if error?
			# We want to flush every 50 ops, i.e. 50, 100, 150, etc
			# Find out which 'block' (i.e. 0-49, 50-99) we were in before and after pushing these
			# ops. If we've changed, then we've gone over a multiple of 50 and should flush.
			# (Most of the time, we will only hit 50 and then flushing will put us back to 0)
			previousLength = length - ops.length
			prevBlock = Math.floor(previousLength / HistoryManager.FLUSH_EVERY_N_OPS)
			newBlock  = Math.floor(length / HistoryManager.FLUSH_EVERY_N_OPS)
			if newBlock != prevBlock
				# Do this in the background since it uses HTTP and so may be too
				# slow to wait for when processing a doc update.
				logger.log length: length, doc_id: doc_id, project_id: project_id, "flushing track changes api"
				HistoryManager.flushDocChanges project_id, doc_id,  (error) ->
					if error?
						logger.error err: error, doc_id: doc_id, project_id: project_id, "error flushing doc to track changes api"
			callback()