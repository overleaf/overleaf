ShareJsModel = require "./sharejs/server/model"
ShareJsDB = require "./ShareJsDB"
async = require "async"
logger = require "logger-sharelatex"
Settings = require('settings-sharelatex')
Keys = require "./UpdateKeys"
{EventEmitter} = require "events"
util = require "util"

redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)


ShareJsModel:: = {}
util.inherits ShareJsModel, EventEmitter

module.exports = ShareJsUpdateManager =
	getNewShareJsModel: () ->
		db = new ShareJsDB()
		model = new ShareJsModel(db, maxDocLength: Settings.max_doc_length)
		model.db = db
		return model

	applyUpdates: (project_id, doc_id, updates, callback = (error, updatedDocLines) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, updates: updates, "applying sharejs updates"
		jobs = []

		# We could use a global model for all docs, but we're hitting issues with the
		# internal state of ShareJS not being accessible for clearing caches, and
		# getting stuck due to queued callbacks (line 260 of sharejs/server/model.coffee)
		# This adds a small but hopefully acceptable overhead (~12ms per 1000 updates on
		# my 2009 MBP).
		model = @getNewShareJsModel()
		@_listenForOps(model)
		doc_key = Keys.combineProjectIdAndDocId(project_id, doc_id)
		for update in updates
			do (update) =>
				jobs.push (callback) =>
					model.applyOp doc_key, update, (error) ->
						if error == "Op already submitted"
							logger.warn {project_id, doc_id, update}, "op has already been submitted"
							update.dup = true
							ShareJsUpdateManager._sendOp(project_id, doc_id, update)
							callback()
						else
							callback(error)

		async.series jobs, (error) =>
			logger.log project_id: project_id, doc_id: doc_id, error: error, "applied updates"
			if error?
				@_sendError(project_id, doc_id, error)
				return callback(error)
			model.getSnapshot doc_key, (error, data) =>
				if error?
					@_sendError(project_id, doc_id, error)
					return callback(error)
				docLines = data.snapshot.split(/\r\n|\n|\r/)
				callback(null, docLines, data.v, model.db.appliedOps[doc_key] or [])

	_listenForOps: (model) ->
		model.on "applyOp", (doc_key, opData) ->
			[project_id, doc_id] = Keys.splitProjectIdAndDocId(doc_key)
			ShareJsUpdateManager._sendOp(project_id, doc_id, opData)
	
	_sendOp: (project_id, doc_id, opData) ->
		data =
			project_id: project_id
			doc_id: doc_id
			op: opData
		data = JSON.stringify data
		rclient.publish "applied-ops", data

	_sendError: (project_id, doc_id, error) ->
		data = JSON.stringify
			project_id: project_id
			doc_id: doc_id
			error: error.message || error
		rclient.publish "applied-ops", data
		
