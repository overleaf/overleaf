logger = require("logger-sharelatex")
request = require("request")
settings = require("settings-sharelatex")
ProjectLocator = require("../Project/ProjectLocator")
U = require('underscore')
Async = require('async')

oneMinInMs = 60 * 1000
fiveMinsInMs = oneMinInMs * 5


module.exports = ReferencesSearchHandler =

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

	indexProjectReferences: (project, callback = (err) ->) ->
		logger.log {projectId: project._id}, "try indexing references from project"
		ids = ReferencesSearchHandler._findBibDocIds(project)
		logger.log {projectId: project._id, count: ids.length}, "found bib files in project"
		Async.eachSeries(
			ids,
			(docId, next) ->
				ReferencesSearchHandler.indexFile project._id, docId, (err) ->
					next(err)
			, (err) ->
				logger.log {projectId: project._id, count: ids.length}, "done index bib files in project"
				callback(err)
		)

	indexFile: (project_id, file_id, callback = (err)->) ->
		logger.log {project_id, file_id}, "sending index request to references api"
		target_url = "#{settings.apis.references.url}/project/#{project_id}"
		file_url = ReferencesSearchHandler._buildDocUrl project_id, file_id
		request.post {
			url: target_url
			json:
				referencesUrl: file_url
		}, (err, res, result) ->
			if err
				return callback(err)
			if 200 <= res.statusCode < 300
				return callback(null)
			else
				err = new Error("references api responded with non-success code: #{res.statusCode}")
				logger.log {err, project_id, file_url}, "error updating references"
				return callback(err)

	getKeys: (project_id, callback = (err, result)->) ->
		logger.log {project_id}, "getting keys from remote references api"
		url = "#{settings.apis.references.url}/project/#{project_id}/keys"
		request.get {
			url: url
			json: true
		}, (err, res, result) ->
			if err
				return callback(err)
			if 200 <= res.statusCode < 300
				return callback(null, result)
			else
				err = new Error("references api responded with non-success code: #{res.statusCode}")
				logger.log {err, project_id}, "error getting references keys"
				return callback(err)

	_buildDocUrl: (project_id, doc_id) ->
		"#{settings.apis.web.url}/project/#{project_id}/doc/#{doc_id}"
