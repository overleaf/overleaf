logger = require('logger-sharelatex')
ReferalHandler = require('./ReferalHandler')
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports =
	bonus: (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		ReferalHandler.getReferedUsers user_id, (err, refered_users, refered_user_count)->
			res.render "referal/bonus",
				title: "bonus_please_recommend_us"
				refered_users: refered_users
				refered_user_count: refered_user_count
