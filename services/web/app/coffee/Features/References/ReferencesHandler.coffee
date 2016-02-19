logger = require("logger-sharelatex")
request = require("request")
settings = require("settings-sharelatex")
Project = require("../../models/Project").Project
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
U = require('underscore')
Async = require('async')

oneMinInMs = 60 * 1000
fiveMinsInMs = oneMinInMs * 5


module.exports = ReferencesHandler =

	_buildDocUrl: (projectId, docId) ->
		"#{settings.apis.docstore.url}/project/#{projectId}/doc/#{docId}/raw"

	_findBibDocIds: (project) ->
		ids = []

		_process = (folder) ->
			folder.docs.forEach (doc) ->
				if doc?.name?.match(/^.*\.bib$/)
					ids.push(doc._id)
			folder.folders.forEach (folder) ->
				_process(folder)

		project.rootFolder.forEach (rootFolder) ->
			_process(rootFolder)

		return ids

	_isFullIndex: (project, callback = (err, result) ->) ->
		owner = project.owner_ref
		callback(null, owner.features.references == true)

	indexAll: (projectId, callback=(err, data)->) ->
		Project.findPopulatedById projectId, (err, project) ->
			if err
				logger.err {err, projectId}, "error finding project"
				return callback(err)
			logger.log {projectId}, "indexing all bib files in project"
			docIds = ReferencesHandler._findBibDocIds(project)
			ReferencesHandler._doIndexOperation(projectId, project, docIds, callback)

	index: (projectId, docIds, callback=(err, data)->) ->
		Project.findPopulatedById projectId, (err, project) ->
			if err
				logger.err {err, projectId}, "error finding project"
				return callback(err)
			ReferencesHandler._doIndexOperation(projectId, project, docIds, callback)

	_doIndexOperation: (projectId, project, docIds, callback) ->
		ReferencesHandler._isFullIndex project, (err, isFullIndex) ->
			if err
				logger.err {err, projectId}, "error checking whether to do full index"
				return callback(err)
			logger.log {projectId, docIds}, 'flushing docs to mongo before calling references service'
			Async.series(
				docIds.map((docId) -> (cb) -> DocumentUpdaterHandler.flushDocToMongo(projectId, docId, cb)),
				(err) ->
					# continue
					if err
						logger.err {err, projectId, docIds}, "error flushing docs to mongo"
						return callback(err)
					bibDocUrls = docIds.map (docId) ->
						ReferencesHandler._buildDocUrl projectId, docId
					logger.log {projectId, isFullIndex, docIds, bibDocUrls}, "sending request to references service"
					request.post {
						url: "#{settings.apis.references.url}/project/#{projectId}/index"
						json:
							docUrls: bibDocUrls
							fullIndex: isFullIndex
					}, (err, res, data) ->
						if err
							logger.err {err, projectId}, "error communicating with references api"
							return callback(err)
						if 200 <= res.statusCode < 300
							logger.log {projectId}, "got keys from references api"
							return callback(null, data)
						else
							err = new Error("references api responded with non-success code: #{res.statusCode}")
							logger.log {err, projectId}, "error updating references"
							return callback(err)
			)
