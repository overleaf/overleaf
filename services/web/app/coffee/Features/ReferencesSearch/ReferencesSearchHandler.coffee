logger = require("logger-sharelatex")
request = require("request")
settings = require("settings-sharelatex")
Project = require("../../models/Project").Project
U = require('underscore')
Async = require('async')

oneMinInMs = 60 * 1000
fiveMinsInMs = oneMinInMs * 5


module.exports = ReferencesSearchHandler =

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

	# projectId: String, docIds: List[String]|Null
	index: (projectId, docIds, callback=(err, data)->) ->
		Project.findPopulatedById projectId, (err, project) ->
			if err
				logger.err {err, projectId}, "error finding project"
				return callback(err)
			if docIds == "ALL"
				logger.log {projectId}, "indexing all bib files in project"
				docIds = ReferencesSearchHandler._findBibDocIds(project)
			ReferencesSearchHandler._isFullIndex project, (err, isFullIndex) ->
				if err
					logger.err {err, projectId}, "error checking whether to do full index"
					return callback(err)
				bibDocUrls = docIds.map (docId) ->
					ReferencesSearchHandler._buildDocUrl projectId, docId
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
