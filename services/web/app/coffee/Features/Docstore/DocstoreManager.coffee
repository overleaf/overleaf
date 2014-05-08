request = require("request").defaults(jar: false)
logger = require "logger-sharelatex"
settings = require "settings-sharelatex"

module.exports = DocstoreManager =
	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, "deleting doc in docstore api"
		url = "#{settings.apis.docstore.url}/project/#{project_id}/doc/#{doc_id}"
		request.del url, (error, res, body) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				callback(null)
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error deleting doc in docstore"
				callback(error)

	getAllDocs: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "getting all docs for project in docstore api"
		url = "#{settings.apis.docstore.url}/project/#{project_id}/doc"
		request.get {
			url: url
			json: true
		}, (error, res, docs) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				callback(null, docs)
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, "error getting all docs from docstore"
				callback(error)

	getDoc: (project_id, doc_id, callback = (error, lines, version, rev) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, "getting doc in docstore api"
		url = "#{settings.apis.docstore.url}/project/#{project_id}/doc/#{doc_id}"
		request.get {
			url: url
			json: true
		}, (error, res, doc) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				logger.log doc_id: doc_id, project_id: project_id, version: doc.version, rev: doc.rev, "got doc from docstore api"
				callback(null, doc.lines, doc.version, doc.rev)
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error getting doc from docstore"
				callback(error)

	updateDoc: (project_id, doc_id, lines, version, callback = (error, rev) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, version: version, "updating doc in docstore api"
		url = "#{settings.apis.docstore.url}/project/#{project_id}/doc/#{doc_id}"
		request.post {
			url: url
			json:
				lines: lines
				version: version
		}, (error, res, body) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				callback(null)
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error updating doc in docstore"
				callback(error)
