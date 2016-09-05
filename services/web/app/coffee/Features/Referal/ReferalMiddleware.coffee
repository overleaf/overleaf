User = require("../../models/User").User
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = RefererMiddleware =
	getUserReferalId: (req, res, next) ->
		if AuthenticationController.isUserLoggedIn()?
			AuthenticationController.getLoggedInUser req, (error, user) ->
				return next(error) if error?
				req.user.referal_id = user.referal_id
				next()
		else
			next()
