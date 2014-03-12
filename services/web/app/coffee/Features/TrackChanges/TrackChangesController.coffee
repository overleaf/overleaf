logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"
AuthenticationController = require "../Authentication/AuthenticationController"

module.exports = TrackChangesController =
	proxyToTrackChangesApi: (req, res, next = (error) ->) ->
		AuthenticationController.getLoggedInUserId req, (error, user_id) ->
			return next(error) if error?
			url = settings.apis.trackchanges.url + req.url
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