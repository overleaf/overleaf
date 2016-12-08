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

	getDoc: (project_id, doc_id, options = {}, callback = (error, lines, rev, version) ->) ->
		if typeof(options) == "function"
			callback = options
			options = {}
		logger.log project_id: project_id, doc_id: doc_id, options: options, "getting doc in docstore api"
		url = "#{settings.apis.docstore.url}/project/#{project_id}/doc/#{doc_id}"
		if options.include_deleted
			url += "?include_deleted=true"
		request.get {
			url: url
			json: true
		}, (error, res, doc) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				logger.log doc_id: doc_id, project_id: project_id, version: doc.version, rev: doc.rev, "got doc from docstore api"
				callback(null, doc.lines, doc.rev, doc.version, doc.ranges)
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error getting doc from docstore"
				callback(error)

	updateDoc: (project_id, doc_id, lines, version, ranges, callback = (error, modified, rev) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, "updating doc in docstore api"
		url = "#{settings.apis.docstore.url}/project/#{project_id}/doc/#{doc_id}"
		request.post {
			url: url
			json:
				lines: lines
				version: version
				ranges: ranges
		}, (error, res, result) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				logger.log project_id: project_id, doc_id: doc_id, "update doc in docstore url finished"
				callback(null, result.modified, result.rev)
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, doc_id: doc_id, "error updating doc in docstore"
				callback(error)

	archiveProject: (project_id, callback)->
		url = "#{settings.apis.docstore.url}/project/#{project_id}/archive"
		logger.log project_id:project_id, "archiving project in docstore"
		request.post url, (err, res, docs) ->
			if err?
				logger.err err:err, project_id:project_id, "error archving project in docstore"
				return callback(err)
			if 200 <= res.statusCode < 300
				callback()	
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.err err: error, project_id: project_id, "error archiving project in docstore"
				return callback(error)

	unarchiveProject: (project_id, callback)->
		url = "#{settings.apis.docstore.url}/project/#{project_id}/unarchive"
		logger.log project_id:project_id, "unarchiving project in docstore"
		request.post url, (err, res, docs) ->
			if err?
				logger.err err:err, project_id:project_id, "error unarchiving project in docstore"
				return callback(err)
			if 200 <= res.statusCode < 300
				callback()	
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.err err: error, project_id: project_id, "error unarchiving project in docstore"
				return callback(error)