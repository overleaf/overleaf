AnalyticsManager = require "./AnalyticsManager"
Errors = require "../Errors/Errors"


module.exports = AnalyticsController =
	recordEvent: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req) or req.sessionID
		AnalyticsManager.recordEvent user_id, req.params.event, req.body, (error) ->
			if error?
				if error instanceof Errors.ServiceNotConfiguredError
					# ignore, no-op
					return res.send(204)
				else
					return next(error)
			res.send 204
