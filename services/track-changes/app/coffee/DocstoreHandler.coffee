request = require("request").defaults(jar: false)
logger = require "logger-sharelatex"
settings = require "settings-sharelatex"

module.exports = DocstoreHandler =

	getAllDocs: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "getting all docs for project in docstore api"
		url = "#{settings.apis.docstore.url}/project/#{project_id}/doc"
		request.get {
			url: url
			json: true
		}, (error, res, docs) ->
			return callback(error) if error?
			logger.log {error, res, docs: if docs?.length then docs.map (d) -> d._id else []}, "docstore response"
			if 200 <= res.statusCode < 300
				callback(null, docs)
			else
				error = new Error("docstore api responded with non-success code: #{res.statusCode}")
				logger.error err: error, project_id: project_id, "error getting all docs from docstore"
				callback(error)
