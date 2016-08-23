Keys = require('./UpdateKeys')
Settings = require('settings-sharelatex')
DocumentManager = require "./DocumentManager"
RedisManager = require "./RedisManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"

module.exports = class ShareJsDB
	constructor: () ->
		@appliedOps = {}
		# ShareJS calls this detacted from the instance, so we need
		# bind it to keep our context that can access @appliedOps
		@writeOp = @_writeOp.bind(@)
	
	getOps: (doc_key, start, end, callback) ->
		if start == end
			return callback null, []

		# In redis, lrange values are inclusive.
		if end?
			end--
		else
			end = -1

		[project_id, doc_id] = Keys.splitProjectIdAndDocId(doc_key)
		RedisManager.getPreviousDocOps doc_id, start, end, callback
	
	_writeOp: (doc_key, opData, callback) ->
		@appliedOps[doc_key] ?= []
		@appliedOps[doc_key].push opData
		callback()

	getSnapshot: (doc_key, callback) ->
		[project_id, doc_id] = Keys.splitProjectIdAndDocId(doc_key)
		DocumentManager.getDoc project_id, doc_id, (error, lines, version) ->
			return callback(error) if error?
			if !lines? or !version?
				return callback(new Errors.NotFoundError("document not found: #{doc_id}"))

			if lines.length > 0 and lines[0].text?
				type = "json"
				snapshot = lines: lines
			else
				type = "text"
				snapshot = lines.join("\n")
			callback null,
				snapshot: snapshot
				v: parseInt(version, 10)
				type: type

	# To be able to remove a doc from the ShareJS memory
	# we need to called Model::delete, which calls this 
	# method on the database. However, we will handle removing
	# it from Redis ourselves
	delete: (docName, dbMeta, callback) -> callback()
