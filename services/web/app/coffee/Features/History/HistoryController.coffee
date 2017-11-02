logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"
AuthenticationController = require "../Authentication/AuthenticationController"

module.exports = HistoryController =
	initializeProject: (callback = (error, history_id) ->) ->
		return callback() if !settings.apis.project_history?.enabled
		request.post {
			url: "#{settings.apis.project_history.url}/project"
		}, (error, res, body)->
			return callback(error) if error?

			if res.statusCode >= 200 and res.statusCode < 300
				try
					project = JSON.parse(body)
				catch error
					return callback(error)

				overleaf_id = project?.project?.id
				if !overleaf_id
					error = new Error("project-history did not provide an id", project)
					return callback(error)

				callback null, { overleaf_id }
			else
				error = new Error("project-history returned a non-success status code: #{res.statusCode}")
				callback error

	proxyToHistoryApi: (req, res, next = (error) ->) ->
		user_id = AuthenticationController.getLoggedInUserId req
		url = HistoryController.buildHistoryServiceUrl() + req.url

		logger.log url: url, "proxying to track-changes api"
		getReq = request(
			url: url
			method: req.method
			headers:
				"X-User-Id": user_id
		)
		getReq.pipe(res)
		getReq.on "error", (error) ->
			logger.error err: error, "track-changes API error"
			next(error)

	buildHistoryServiceUrl: () ->
		if settings.apis.project_history?.enabled
			return settings.apis.project_history.url
		else
			return settings.apis.trackchanges.url
