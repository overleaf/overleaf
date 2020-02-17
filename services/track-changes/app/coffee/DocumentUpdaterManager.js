request = require "request"
logger = require "logger-sharelatex"
Settings = require "settings-sharelatex"

module.exports = DocumentUpdaterManager =
	getDocument: (project_id, doc_id, callback = (error, content, version) ->) ->
		url = "#{Settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}"
		logger.log project_id:project_id, doc_id: doc_id, "getting doc from document updater"
		request.get url, (error, res, body)->
			if error?
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				try
					body = JSON.parse(body)
				catch error
					return callback(error)
				logger.log {project_id, doc_id, version: body.version}, "got doc from document updater"
				callback null, body.lines.join("\n"), body.version
			else
				error = new Error("doc updater returned a non-success status code: #{res.statusCode}")
				logger.error err: error, project_id:project_id, doc_id:doc_id, url: url, "error accessing doc updater"
				callback error

	setDocument: (project_id, doc_id, content, user_id, callback = (error) ->) ->
		url = "#{Settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}"
		logger.log project_id:project_id, doc_id: doc_id, "setting doc in document updater"
		request.post {
			url: url
			json:
				lines: content.split("\n")
				source: "restore"
				user_id: user_id
				undoing: true
		}, (error, res, body)->
			if error?
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				callback null
			else
				error = new Error("doc updater returned a non-success status code: #{res.statusCode}")
				logger.error err: error, project_id:project_id, doc_id:doc_id, url: url, "error accessing doc updater"
				callback error