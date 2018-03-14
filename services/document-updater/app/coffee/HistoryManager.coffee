async = require "async"
logger = require "logger-sharelatex"
request  = require "request"
Settings = require "settings-sharelatex"
HistoryRedisManager = require "./HistoryRedisManager"
ProjectHistoryRedisManager = require "./ProjectHistoryRedisManager"
RedisManager = require "./RedisManager"

module.exports = HistoryManager =
	flushDocChangesAsync: (project_id, doc_id) ->
		if !Settings.apis?.trackchanges?
			logger.warn { doc_id }, "track changes API is not configured, so not flushing"
			return

		url = "#{Settings.apis.trackchanges.url}/project/#{project_id}/doc/#{doc_id}/flush"
		logger.log { project_id, doc_id, url }, "flushing doc in track changes api"
		request.post url, (error, res, body)->
			if error?
				logger.error { error, doc_id, project_id}, "track changes doc to track changes api"
			else if res.statusCode < 200 and res.statusCode >= 300
				logger.error { doc_id, project_id }, "track changes api returned a failure status code: #{res.statusCode}"

	flushProjectChangesAsync: (project_id) ->
		return if !Settings.apis?.project_history?.enabled

		url = "#{Settings.apis.project_history.url}/project/#{project_id}/flush"
		logger.log { project_id, url }, "flushing doc in project history api"
		request.post url, (error, res, body)->
			if error?
				logger.error { error, project_id}, "project history doc to track changes api"
			else if res.statusCode < 200 and res.statusCode >= 300
				logger.error { project_id }, "project history api returned a failure status code: #{res.statusCode}"

	FLUSH_DOC_EVERY_N_OPS: 100
	FLUSH_PROJECT_EVERY_N_OPS: 500

	recordAndFlushHistoryOps: (project_id, doc_id, ops = [], doc_ops_length, project_ops_length, callback = (error) ->) ->
		if ops.length == 0
			return callback()

		if Settings.apis?.project_history?.enabled
			if HistoryManager.shouldFlushHistoryOps(project_ops_length, ops.length, HistoryManager.FLUSH_PROJECT_EVERY_N_OPS)
				# Do this in the background since it uses HTTP and so may be too
				# slow to wait for when processing a doc update.
				logger.log { project_ops_length, project_id }, "flushing project history api"
				HistoryManager.flushProjectChangesAsync project_id

		HistoryRedisManager.recordDocHasHistoryOps project_id, doc_id, ops, (error) ->
			return callback(error) if error?
			if HistoryManager.shouldFlushHistoryOps(doc_ops_length, ops.length, HistoryManager.FLUSH_DOC_EVERY_N_OPS)
				# Do this in the background since it uses HTTP and so may be too
				# slow to wait for when processing a doc update.
				logger.log { doc_ops_length, doc_id, project_id }, "flushing track changes api"
				HistoryManager.flushDocChangesAsync project_id, doc_id
			callback()

	shouldFlushHistoryOps: (length, ops_length, threshold) ->
		return false if !length # don't flush unless we know the length
		# We want to flush every 100 ops, i.e. 100, 200, 300, etc
		# Find out which 'block' (i.e. 0-99, 100-199) we were in before and after pushing these
		# ops. If we've changed, then we've gone over a multiple of 100 and should flush.
		# (Most of the time, we will only hit 100 and then flushing will put us back to 0)
		previousLength = length - ops_length
		prevBlock = Math.floor(previousLength / threshold)
		newBlock  = Math.floor(length / threshold)
		return newBlock != prevBlock

	resyncProjectHistory: (project_id, docs, files, callback) ->
		ProjectHistoryRedisManager.queueResyncProjectStructure project_id, docs, files, (error) ->
			return callback(error) if error?
			DocumentManager = require "./DocumentManager"
			resyncDoc = (doc, cb) ->
				DocumentManager.resyncDocContentsWithLock project_id, doc.doc, cb
			async.each docs, resyncDoc, callback
