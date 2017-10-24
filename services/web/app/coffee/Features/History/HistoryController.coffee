logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"
AuthenticationController = require "../Authentication/AuthenticationController"

module.exports = HistoryController =
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
