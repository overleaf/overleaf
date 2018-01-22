AnalyticsManager = require "./AnalyticsManager"
Errors = require "../Errors/Errors"
AuthenticationController = require("../Authentication/AuthenticationController")

module.exports = AnalyticsController =
	updateEditSession: (req, res, next) ->
		userId    = AuthenticationController.getLoggedInUserId(req) or req.sessionID
		projectId = req.params.projectId

		AnalyticsManager.updateEditSession userId, projectId, {}, (error) ->
			if error instanceof Errors.ServiceNotConfiguredError
				# ignore, no-op
				return res.send(204)
			else if error?
				return next(error)
			else
				return res.send 204

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
