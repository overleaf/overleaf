logger = require('logger-sharelatex')
ReferencesSearchHandler = require('./ReferencesSearchHandler')
ProjectLocator = require("../Project/ProjectLocator")
settings = require('settings-sharelatex')
U = require('underscore')


module.exports = ReferencesSearchController =

	indexFile: (req, res) ->
		project_id = req.params.Project_id
		user_id = req.session.user._id
		doc_id = req.body.docId
		logger.log {project_id, user_id, doc_id}, "indexing references"

		if !doc_id
			logger.log project_id: project_id, user_id: user_id, "no fileUrl supplied"
			return res.send 400
		ProjectLocator.findElement {project_id: project_id, element_id: doc_id, type: 'doc'}, (err, doc) ->
			if err?
				logger.err {err, project_id, user_id, doc_id}, "error finding element for downloading file"
				return res.send 500
			doc_url = ReferencesSearchController._buildDocUrl project_id, doc_id
			console.log ">>"
			console.log doc, doc_url
			console.log "<<"
			ReferencesSearchHandler.indexFile user_id, doc_url, (err) ->
				if err
					logger.err {err, project_id, user_id, doc_id}, "error indexing references file"
					return res.send 500

				res.send 200

	_buildDocUrl: (project_id, doc_id) ->
		"#{settings.apis.web.url}/project/#{project_id}/doc/#{doc_id}"
