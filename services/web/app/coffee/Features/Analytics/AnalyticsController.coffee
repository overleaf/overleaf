AnalyticsManager = require "./AnalyticsManager"

module.exports = AnalyticsController =
	recordEvent: (req, res, next) ->
		AnalyticsManager.recordEvent req.session?.user?._id, req.params.event, req.body, (error) ->
			return next(error) if error?
			res.send 204