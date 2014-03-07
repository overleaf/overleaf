logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"

module.exports = TrackChangesController =
	proxyToTrackChangesApi: (req, res, next = (error) ->) ->
		url = settings.apis.trackchanges.url + req.url
		logger.log url: url, "proxying to track-changes api"
		getReq = request.get(url)
		getReq.pipe(res)
		getReq.on "error", (error) ->
			logger.error err: error, "track-changes API error"
			next(error)