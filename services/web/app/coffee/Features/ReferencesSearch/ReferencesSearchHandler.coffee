logger = require("logger-sharelatex")
request = require("request")
settings = require("settings-sharelatex")

oneMinInMs = 60 * 1000
fiveMinsInMs = oneMinInMs * 5


module.exports = ReferencesSearchHandler =

	indexFile: (user_id, file_url, callback = (err)->) ->
		logger.log {user_id, file_url}, "sending index request to references api"
		url = "#{settings.apis.references.url}/user/#{user_id}"
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
				logger.log {err, user_id, file_url}, "error updating references"
				return callback(err)
