request = require 'request'
request = request.defaults()
settings = require 'settings-sharelatex'
_ = require 'underscore'
async = require 'async'
logger = require('logger-sharelatex')
metrics = require('metrics-sharelatex')
FileStoreHandler = require("../FileStore/FileStoreHandler")
Project = require("../../models/Project").Project
ProjectGetter = require "../Project/ProjectGetter"

module.exports = DocumentUpdaterHandler =
	flushProjectToMongo: (project_id, callback = (error) ->)->
		logger.log project_id:project_id, "flushing project from document updater"
		timer = new metrics.Timer("flushing.mongo.project")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/flush"
		request.post url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, "error flushing project from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, "flushed project from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)

	flushMultipleProjectsToMongo: (project_ids, callback = (error) ->) ->
		jobs = []
		for project_id in project_ids
			do (project_id) ->
				jobs.push (callback) ->
					DocumentUpdaterHandler.flushProjectToMongo project_id, callback
		async.series jobs, callback

	flushProjectToMongoAndDelete: (project_id, callback = ()->) ->
		logger.log project_id:project_id, "deleting project from document updater"
		timer = new metrics.Timer("delete.mongo.project")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}"
		request.del url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, "error deleting project from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, "deleted project from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)

	flushDocToMongo: (project_id, doc_id, callback = (error) ->) ->
		logger.log project_id:project_id, doc_id: doc_id, "flushing doc from document updater"
		timer = new metrics.Timer("flushing.mongo.doc")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}/flush"
		request.post url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error flushing doc from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, doc_id: doc_id, "flushed doc from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)
	
	deleteDoc : (project_id, doc_id, callback = ()->)->
		logger.log project_id:project_id, doc_id: doc_id, "deleting doc from document updater"
		timer = new metrics.Timer("delete.mongo.doc")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}"
		request.del url, (error, res, body)->
			if error?
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error deleting doc from document updater"
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, doc_id: doc_id, "deleted doc from document updater"
				return callback(null)
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "document updater returned failure status code: #{res.statusCode}"
				return callback(error)

	getDocument: (project_id, doc_id, fromVersion, callback = (error, doclines, version, ranges, ops) ->) ->
		timer = new metrics.Timer("get-document")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}?fromVersion=#{fromVersion}"
		logger.log project_id:project_id, doc_id: doc_id, "getting doc from document updater"
		request.get url, (error, res, body)->
			timer.done()
			if error?
				logger.error err:error, url:url, project_id:project_id, doc_id:doc_id, "error getting doc from doc updater"
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id:project_id, doc_id:doc_id, "got doc from document document updater"
				try
					body = JSON.parse(body)
				catch error
					return callback(error)
				callback null, body.lines, body.version, body.ranges, body.ops
			else
				logger.error project_id:project_id, doc_id:doc_id, url: url, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	setDocument : (project_id, doc_id, user_id, docLines, source, callback = (error) ->)->
		timer = new metrics.Timer("set-document")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}"
		body =
			url: url
			json:
				lines: docLines
				source: source
				user_id: user_id
		logger.log project_id:project_id, doc_id: doc_id, source: source, user_id: user_id, "setting doc in document updater"
		request.post body, (error, res, body)->
			timer.done()
			if error?
				logger.error err:error, url:url, project_id:project_id, doc_id:doc_id, "error setting doc in doc updater"
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id: project_id, doc_id: doc_id, "set doc in document updater"
				return callback(null)
			else
				logger.error project_id:project_id, doc_id:doc_id, url: url, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	getProjectDocsIfMatch: (project_id, projectStateHash, callback = (error, docs) ->) ->
		# If the project state hasn't changed, we can get all the latest
		# docs from redis via the docupdater. Otherwise we will need to
		# fall back to getting them from mongo.
		timer = new metrics.Timer("get-project-docs")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/get_and_flush_if_old?state=#{projectStateHash}"
		logger.log project_id:project_id, "getting project docs from document updater"
		request.post url, (error, res, body)->
			timer.done()
			if error?
				logger.error err:error, url:url, project_id:project_id, "error getting project docs from doc updater"
				return callback(error)
			if res.statusCode is 409 # HTTP response code "409 Conflict"
				# Docupdater has checked the projectStateHash and found that
				# it has changed. This means that the docs currently in redis
				# aren't the only change to the project and the full set of
				# docs/files should be retreived from docstore/filestore
				# instead.
				return callback()
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log project_id:project_id, "got project docs from document document updater"
				try
					docs = JSON.parse(body)
				catch error
					return callback(error)
				callback null, docs
			else
				logger.error project_id:project_id, url: url, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	clearProjectState: (project_id, callback = (error) ->) ->
		timer = new metrics.Timer("clear-project-state")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/clearState"
		logger.log project_id:project_id, "clearing project state from document updater"
		request.post url, (error, res)->
			timer.done()
			if error?
				logger.error err:error, url:url, project_id:project_id, "error clearing project state from doc updater"
				return callback(error)
			else if res.statusCode is 200
				logger.log project_id:project_id, "cleared project state from doc updater"
				callback()
			else
				logger.error project_id:project_id, url: url, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	acceptChanges: (project_id, doc_id, change_ids = [], callback = (error) ->) ->
		timer = new metrics.Timer("accept-changes")
		reqSettings =
			url: "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}/change/accept"
			json:
				change_ids: change_ids
		logger.log {project_id, doc_id }, "accepting #{ change_ids.length } changes"
		request.post reqSettings, (error, res, body)->
			timer.done()
			if error?
				logger.error {err:error, project_id, doc_id }, "error accepting #{ change_ids.length } changes in doc updater"
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				logger.log {project_id, doc_id }, "accepted #{ change_ids.length } changes in document updater"
				return callback(null)
			else
				logger.error {project_id, doc_id }, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	deleteThread: (project_id, doc_id, thread_id, callback = (error) ->) ->
		timer = new metrics.Timer("delete-thread")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}/comment/#{thread_id}"
		logger.log {project_id, doc_id, thread_id}, "deleting comment range in document updater"
		request.del url, (error, res, body)->
			timer.done()
			if error?
				logger.error {err:error, project_id, doc_id, thread_id}, "error deleting comment range in doc updater"
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				logger.log {project_id, doc_id, thread_id}, "deleted comment rangee in document updater"
				return callback(null)
			else
				logger.error {project_id, doc_id, thread_id}, "doc updater returned a non-success status code: #{res.statusCode}"
				callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	resyncProjectHistory: (project_id, docs, files, callback) ->
		request.post
			url: "#{settings.apis.documentupdater.url}/project/#{project_id}/history/resync"
			json: { docs, files }
		, (error, res, body) ->
			if error?
				logger.error {error, project_id}, "error resyncing project in doc updater"
				callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				logger.log {project_id}, "resynced project in doc updater"
				callback()

	updateProjectStructure : (project_id, userId, changes, callback = (error) ->)->
		return callback() if !settings.apis.project_history?.sendProjectStructureOps
		Project.findOne {_id: project_id}, {version:true}, (err, currentProject) ->
			return callback(err) if err?
			return callback new Error("project not found") if !currentProject?

			docUpdates = DocumentUpdaterHandler._getUpdates('doc', changes.oldDocs, changes.newDocs)
			fileUpdates = DocumentUpdaterHandler._getUpdates('file', changes.oldFiles, changes.newFiles)

			timer = new metrics.Timer("set-document")
			url = "#{settings.apis.documentupdater.url}/project/#{project_id}"
			body =
				url: url
				json: { docUpdates, fileUpdates, userId, version: currentProject.version }

			return callback() if (docUpdates.length + fileUpdates.length) < 1

			request.post body, (error, res, body)->
				timer.done()
				if error?
					logger.error {error, url, project_id}, "error update project structure in doc updater"
					callback(error)
				else if res.statusCode >= 200 and res.statusCode < 300
					logger.log {project_id}, "updated project structure in doc updater"
					callback(null)
				else
					logger.error {project_id, url}, "doc updater returned a non-success status code: #{res.statusCode}"
					callback new Error("doc updater returned a non-success status code: #{res.statusCode}")

	_getUpdates: (entityType, oldEntities, newEntities) ->
		oldEntities ||= []
		newEntities ||= []
		updates = []

		oldEntitiesHash = _.indexBy oldEntities, (entity) -> entity[entityType]._id.toString()
		newEntitiesHash = _.indexBy newEntities, (entity) -> entity[entityType]._id.toString()

		for id, newEntity of newEntitiesHash
			oldEntity = oldEntitiesHash[id]

			if !oldEntity?
				# entity added
				updates.push
					id: id
					pathname: newEntity.path
					docLines: newEntity.docLines
					url: newEntity.url
			else if newEntity.path != oldEntity.path
				# entity renamed
				updates.push
					id: id
					pathname: oldEntity.path
					newPathname: newEntity.path

		for id, oldEntity of oldEntitiesHash
			newEntity = newEntitiesHash[id]

			if !newEntity?
				# entity deleted
				updates.push
					id: id
					pathname: oldEntity.path
					newPathname: ''

		updates

PENDINGUPDATESKEY = "PendingUpdates"
DOCLINESKEY = "doclines"
DOCIDSWITHPENDINGUPDATES = "DocsWithPendingUpdates"

keys =
	pendingUpdates : (op) ->  "#{PENDINGUPDATESKEY}:#{op.doc_id}"
	docsWithPendingUpdates: DOCIDSWITHPENDINGUPDATES
	docLines : (op) -> "#{DOCLINESKEY}:#{op.doc_id}"
	combineProjectIdAndDocId: (project_id, doc_id) -> "#{project_id}:#{doc_id}"


