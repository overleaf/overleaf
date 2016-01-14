logger = require("logger-sharelatex")
request = require("request")
settings = require("settings-sharelatex")
ProjectLocator = require("../Project/ProjectLocator")
U = require('underscore')

oneMinInMs = 60 * 1000
fiveMinsInMs = oneMinInMs * 5


module.exports = ReferencesSearchHandler =

	indexProjectReferences: (project_id, docs, callback = (err) ->) ->
		logger.log {project_id}, "try indexing references from project"
		bibDocs = U.filter(docs, (doc) -> doc?.name?.match(/^.*\.bib$/))
		if bibDocs and bibDocs.length == 1  # presume we'll only get either one or zero bib files
			doc = bibDocs[0]
			ReferencesSearchHandler.indexFile project_id, doc._id, (err) ->
				callback(err)

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
