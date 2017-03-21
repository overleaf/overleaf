AnalyticsManager = require "./AnalyticsManager"
Errors = require "../Errors/Errors"


module.exports = AnalyticsController =
	recordEvent: (req, res, next) ->
		AnalyticsManager.recordEvent req.session?.user?._id, req.params.event, req.body, (error) ->
			if error?
				if error instanceof Errors.ServiceNotConfiguredError
					# ignore, no-op
					return next(204)
				else
					return next(error)
			res.send 204
