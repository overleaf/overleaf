logger = require("logger-sharelatex")
request = require("request")
settings = require("settings-sharelatex")
ProjectLocator = require("../Project/ProjectLocator")
U = require('underscore')
Async = require('async')
Project = require("../../models/Project").Project
UserGetter = require "../User/UserGetter"

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

	_isFullIndex: (projectId, callback = (err, result) ->) ->
		Project.findById projectId, {owner_ref: 1}, (err, project) ->
			return callback(err) if err
			UserGetter.getUser project.owner_ref, {features: 1}, (err, owner) ->
				return callback(err) if err
				callback(null, owner.features.references == true)

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

	indexFile: (projectId, fileId, callback = (err)->) ->
		target_url = "#{settings.apis.references.url}/project/#{projectId}"
		fileUrl = ReferencesSearchHandler._buildDocUrl projectId, fileId
		logger.log {projectId, fileId}, "checking if file should be fully indexed"
		ReferencesSearchHandler._isFullIndex projectId, (err, isFullIndex) ->
			if err
				logger.err {projectId, fileId, err}, "error checking if file should be fully indexed"
				return callback(err)
			logger.log {projectId, fileId, isFullIndex}, "sending index request to references api"
			request.post {
				url: target_url
				json:
					referencesUrl: fileUrl
					fullIndex: isFullIndex == true
			}, (err, res, result) ->
				if err
					return callback(err)
				if 200 <= res.statusCode < 300
					return callback(null)
				else
					err = new Error("references api responded with non-success code: #{res.statusCode}")
					logger.log {err, projectId, fileUrl}, "error updating references"
					return callback(err)

	getKeys: (projectId, callback = (err, result)->) ->
		logger.log {projectId}, "getting keys from remote references api"
		url = "#{settings.apis.references.url}/project/#{projectId}/keys"
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
				logger.log {err, projectId}, "error getting references keys"
				return callback(err)

	_buildDocUrl: (projectId, docId) ->
		"#{settings.apis.web.url}/project/#{projectId}/doc/#{docId}"
