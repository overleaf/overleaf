AnalyticsManager = require "./AnalyticsManager"
Errors = require "../Errors/Errors"
AuthenticationController = require("../Authentication/AuthenticationController")
GeoIpLookup = require '../../infrastructure/GeoIpLookup'

module.exports = AnalyticsController =
	updateEditingSession: (req, res, next) ->
		userId    = AuthenticationController.getLoggedInUserId(req)
		projectId = req.params.projectId
		countryCode = null

		if userId?
			GeoIpLookup.getDetails req.ip, (err, geoDetails) ->
				if geoDetails?.country_code? and geoDetails.country_code != ""
					countryCode = geoDetails.country_code
				AnalyticsManager.updateEditingSession userId, projectId, countryCode, (error) ->
					respondWith(error, res, next)
		else
			res.send 204

	recordEvent: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req) or req.sessionID
		AnalyticsManager.recordEvent user_id, req.params.event, req.body, (error) ->
			respondWith(error, res, next)

respondWith = (error, res, next) ->
	if error instanceof Errors.ServiceNotConfiguredError
		# ignore, no-op
		res.send(204)
	else if error?
		next(error)
	else
		res.send 204
