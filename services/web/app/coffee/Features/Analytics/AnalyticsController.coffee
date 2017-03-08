AnalyticsManager = require "./AnalyticsManager"
AuthenticationController = require("../Authentication/AuthenticationController")

module.exports = AnalyticsController =
	recordEvent: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req) or req.sessionID
		AnalyticsManager.recordEvent user_id, req.params.event, req.body, (error) ->
			return next(error) if error?
			res.send 204
