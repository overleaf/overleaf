request = require "request"
logger = require "logger-sharelatex"
settings = require "settings-sharelatex"

module.exports = DocumentUpdaterManager =
	getDocument: (project_id, doc_id, fromVersion, callback = (error, exists, doclines, version) ->) ->
		#timer = new metrics.Timer("get-document")
		url = "#{settings.apis.documentupdater.url}/project/#{project_id}/doc/#{doc_id}?fromVersion=#{fromVersion}"
		logger.log {project_id, doc_id, fromVersion}, "getting doc from document updater"
		request.get url, (err, res, body) ->
			#timer.done()
			if err?
				logger.error {err, url, project_id, doc_id}, "error getting doc from doc updater"
				return callback(err)
			if 200 <= res.statusCode < 300
				logger.log {project_id, doc_id}, "got doc from document document updater"
				try
					body = JSON.parse(body)
				catch error
					return callback(error)
				callback null, body?.lines, body?.version, body?.ops
			else
				err = new Error("doc updater returned a non-success status code: #{res.statusCode}")
				err.statusCode = res.statusCode
				logger.error {err, project_id, doc_id, url}, "doc updater returned a non-success status code: #{res.statusCode}"
				callback err