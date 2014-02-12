User = require("../../models/User").User

module.exports = RefererMiddleware =
	getUserReferalId: (req, res, next) ->
		if req.session? and req.session.user?
			User.findById req.session.user._id, (error, user) ->
				return next(error) if error?
				req.session.user.referal_id = user.referal_id
				next()
		else
			next()
