request = require 'request'
request = request.defaults()
settings = require 'settings-sharelatex'
_ = require 'underscore'
async = require 'async'
logger = require('logger-sharelatex')
metrics = require('metrics-sharelatex')
Project = require("../../models/Project").Project

module.exports = DocumentUpdaterHandler =
	flushProjectToMongo: (project_id, callback = (error) ->)->
		logger.log project_id:project_id, "flushing project from document updater"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/flush"
			method: "POST"
		}, project_id, "flushing.mongo.project", callback

	flushMultipleProjectsToMongo: (project_ids, callback = (error) ->) ->
		jobs = []
		for project_id in project_ids
			do (project_id) ->
				jobs.push (callback) ->
					DocumentUpdaterHandler.flushProjectToMongo project_id, callback
		async.series jobs, callback

	flushProjectToMongoAndDelete: (project_id, callback = ()->) ->
		timer = new metrics.Timer("delete.mongo.project")
		url = "#{settings.apis.documentupdater.url}"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}"
			method: "DELETE"
		}, project_id, "flushing.mongo.project", callback

	flushDocToMongo: (project_id, doc_id, callback = (error) ->) ->
		logger.log project_id:project_id, doc_id: doc_id, "flushing doc from document updater"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/doc/#{doc_id}/flush"
			method: "POST"
		}, project_id, "flushing.mongo.doc", callback

	deleteDoc : (project_id, doc_id, callback = ()->)->
		logger.log project_id:project_id, doc_id: doc_id, "deleting doc from document updater"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/doc/#{doc_id}"
			method: "DELETE"
		}, project_id, "delete.mongo.doc", callback

	getDocument: (project_id, doc_id, fromVersion, callback = (error, doclines, version, ranges, ops) ->) ->
		logger.log project_id:project_id, doc_id: doc_id, "getting doc from document updater"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/doc/#{doc_id}?fromVersion=#{fromVersion}"
			json: true
		}, project_id, "get-document", (error, doc) ->
			return callback(error) if error?
			callback null, doc.lines, doc.version, doc.ranges, doc.ops

	setDocument : (project_id, doc_id, user_id, docLines, source, callback = (error) ->)->
		logger.log project_id:project_id, doc_id: doc_id, source: source, user_id: user_id, "setting doc in document updater"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/doc/#{doc_id}"
			method: "POST"
			json:
				lines: docLines
				source: source
				user_id: user_id
		}, project_id, "set-document", callback

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
		logger.log project_id:project_id, "clearing project state from document updater"

		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/clearState"
			method: "POST"
		}, project_id, "clear-project-state", callback

	acceptChanges: (project_id, doc_id, change_ids = [], callback = (error) ->) ->
		logger.log {project_id, doc_id }, "accepting #{ change_ids.length } changes"

		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/doc/#{doc_id}/change/accept"
			json:
				change_ids: change_ids
			method: "POST"
		}, project_id, "accept-changes", callback

	deleteThread: (project_id, doc_id, thread_id, callback = (error) ->) ->
		timer = new metrics.Timer("delete-thread")
		logger.log {project_id, doc_id, thread_id}, "deleting comment range in document updater"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/doc/#{doc_id}/comment/#{thread_id}"
			method: "DELETE"
		}, project_id, "delete-thread", callback

	resyncProjectHistory: (project_id, projectHistoryId, docs, files, callback) ->
		logger.info {project_id, docs, files}, "resyncing project history in doc updater"
		DocumentUpdaterHandler._makeRequest {
			path: "/project/#{project_id}/history/resync"
			json: { docs, files, projectHistoryId }
			method: "POST"
		}, project_id, "resync-project-history", callback

	updateProjectStructure: (project_id, projectHistoryId, userId, changes, callback = (error) ->)->
		return callback() if !settings.apis.project_history?.sendProjectStructureOps

		Project.findOne {_id: project_id}, {version:true}, (err, currentProject) ->
			return callback(err) if err?
			return callback new Error("project not found") if !currentProject?

			docUpdates = DocumentUpdaterHandler._getUpdates('doc', changes.oldDocs, changes.newDocs)
			fileUpdates = DocumentUpdaterHandler._getUpdates('file', changes.oldFiles, changes.newFiles)

			return callback() if (docUpdates.length + fileUpdates.length) < 1

			logger.log {project_id}, "updating project structure in doc updater"
			DocumentUpdaterHandler._makeRequest {
				path: "/project/#{project_id}"
				json: {
					docUpdates,
					fileUpdates,
					userId,
					version: currentProject.version
					projectHistoryId
				}
				method: "POST"
			}, project_id, "update-project-structure", callback

	_makeRequest: (options, project_id, metricsKey, callback) ->
		timer = new metrics.Timer(metricsKey)
		request {
			url: "#{settings.apis.documentupdater.url}#{options.path}"
			json: options.json
			method: options.method || "GET"
		}, (error, res, body)->
			timer.done()
			if error?
				logger.error {error, project_id}, "error making request to document updater"
				callback error
			else if res.statusCode >= 200 and res.statusCode < 300
				callback null, body
			else
				error = new Error("document updater returned a failure status code: #{res.statusCode}")
				logger.error {error, project_id}, "document updater returned failure status code: #{res.statusCode}"
				callback error

	_getUpdates: (entityType, oldEntities, newEntities) ->
		oldEntities ||= []
		newEntities ||= []
		updates = []

		oldEntitiesHash = _.indexBy oldEntities, (entity) -> entity[entityType]._id.toString()
		newEntitiesHash = _.indexBy newEntities, (entity) -> entity[entityType]._id.toString()

		# Send deletes before adds (and renames) to keep a 1:1 mapping between
		# paths and ids
		#
		# When a file is replaced, we first delete the old file and then add the
		# new file. If the 'add' operation is sent to project history before the
		# 'delete' then we would have two files with the same path at that point
		# in time.
		for id, oldEntity of oldEntitiesHash
			newEntity = newEntitiesHash[id]

			if !newEntity?
				# entity deleted
				updates.push
					id: id
					pathname: oldEntity.path
					newPathname: ''

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

		updates

PENDINGUPDATESKEY = "PendingUpdates"
DOCLINESKEY = "doclines"
DOCIDSWITHPENDINGUPDATES = "DocsWithPendingUpdates"

keys =
	pendingUpdates : (op) ->  "#{PENDINGUPDATESKEY}:#{op.doc_id}"
	docsWithPendingUpdates: DOCIDSWITHPENDINGUPDATES
	docLines : (op) -> "#{DOCLINESKEY}:#{op.doc_id}"
	combineProjectIdAndDocId: (project_id, doc_id) -> "#{project_id}:#{doc_id}"


