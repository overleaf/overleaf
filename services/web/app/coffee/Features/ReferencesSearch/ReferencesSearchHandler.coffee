logger = require("logger-sharelatex")
request = require("request")
settings = require("settings-sharelatex")

oneMinInMs = 60 * 1000
fiveMinsInMs = oneMinInMs * 5


module.exports = ReferencesSearchHandler =

	indexFile: (project_id, file_url, callback = (err)->) ->
		logger.log {project_id, file_url}, "sending index request to references api"
		url = "#{settings.apis.references.url}/project/#{project_id}"
		request.post {
			url: url
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
