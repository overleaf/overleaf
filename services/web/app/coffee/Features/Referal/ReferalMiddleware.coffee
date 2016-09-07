User = require("../../models/User").User
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = RefererMiddleware =
	getUserReferalId: (req, res, next) ->
		if AuthenticationController.isUserLoggedIn()?
			user = AuthenticationController.getSessionUser(req)
			req.user.referal_id = user.referal_id
			next()
		else
			next()
