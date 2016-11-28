ShareJsModel = require "./sharejs/server/model"
ShareJsDB = require "./ShareJsDB"
async = require "async"
logger = require "logger-sharelatex"
Settings = require('settings-sharelatex')
Keys = require "./UpdateKeys"
{EventEmitter} = require "events"
util = require "util"
WebRedisManager = require "./WebRedisManager"

ShareJsModel:: = {}
util.inherits ShareJsModel, EventEmitter

module.exports = ShareJsUpdateManager =
	getNewShareJsModel: (project_id, doc_id, lines, version) ->
		db = new ShareJsDB(project_id, doc_id, lines, version)
		model = new ShareJsModel(db, maxDocLength: Settings.max_doc_length)
		model.db = db
		return model

	applyUpdate: (project_id, doc_id, update, lines, version, callback = (error, updatedDocLines) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, update: update, "applying sharejs updates"
		jobs = []

		# We could use a global model for all docs, but we're hitting issues with the
		# internal state of ShareJS not being accessible for clearing caches, and
		# getting stuck due to queued callbacks (line 260 of sharejs/server/model.coffee)
		# This adds a small but hopefully acceptable overhead (~12ms per 1000 updates on
		# my 2009 MBP).
		model = @getNewShareJsModel(project_id, doc_id, lines, version)
		@_listenForOps(model)
		doc_key = Keys.combineProjectIdAndDocId(project_id, doc_id)
		model.applyOp doc_key, update, (error) ->
			if error?
				if error == "Op already submitted"
					logger.warn {project_id, doc_id, update}, "op has already been submitted"
					update.dup = true
					ShareJsUpdateManager._sendOp(project_id, doc_id, update)
				else
					ShareJsUpdateManager._sendError(project_id, doc_id, error)
					return callback(error)
			logger.log project_id: project_id, doc_id: doc_id, error: error, "applied update"
			model.getSnapshot doc_key, (error, data) =>
				if error?
					ShareJsUpdateManager._sendError(project_id, doc_id, error)
					return callback(error)
				docLines = data.snapshot.split(/\r\n|\n|\r/)
				callback(null, docLines, data.v, model.db.appliedOps[doc_key] or [])

	_listenForOps: (model) ->
		model.on "applyOp", (doc_key, opData) ->
			[project_id, doc_id] = Keys.splitProjectIdAndDocId(doc_key)
			ShareJsUpdateManager._sendOp(project_id, doc_id, opData)
	
	_sendOp: (project_id, doc_id, op) ->
		WebRedisManager.sendData {project_id, doc_id, op}

	_sendError: (project_id, doc_id, error) ->
		WebRedisManager.sendData {project_id, doc_id, error: error.message || error}
		
