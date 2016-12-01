Keys = require('./UpdateKeys')
RedisManager = require "./RedisManager"
Errors = require "./Errors"

module.exports = class ShareJsDB
	constructor: (@project_id, @doc_id, @lines, @version) ->
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
		if doc_key != Keys.combineProjectIdAndDocId(@project_id, @doc_id)
			return callback(new Errors.NotFoundError("unexpected doc_key #{doc_key}, expected #{Keys.combineProjectIdAndDocId(@project_id, @doc_id)}"))
		else
			return callback null, {
				snapshot: @lines.join("\n")
				v: parseInt(@version, 10)
				type: "text"
			}

	# To be able to remove a doc from the ShareJS memory
	# we need to called Model::delete, which calls this 
	# method on the database. However, we will handle removing
	# it from Redis ourselves
	delete: (docName, dbMeta, callback) -> callback()
