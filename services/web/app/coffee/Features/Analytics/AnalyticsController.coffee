AnalyticsManager = require "./AnalyticsManager"
Errors = require "../Errors/Errors"
AuthenticationController = require("../Authentication/AuthenticationController")

module.exports = AnalyticsController =
	recordEvent: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req) or req.sessionID
		AnalyticsManager.recordEvent user_id, req.params.event, req.body, (error) ->
			if error instanceof Errors.ServiceNotConfiguredError
				# ignore, no-op
				return res.send(204)
			else if error?
				return next(error)
			else
				return res.send 204
