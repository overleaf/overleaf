logger = require('logger-sharelatex')
ReferalHandler = require('./ReferalHandler')

module.exports = 
	bonus: (req, res)->
		ReferalHandler.getReferedUserIds req.session.user._id, (err, refered_users)->
			res.render "referal/bonus",
				title: "Bonus - Please recommend us"
				refered_users: refered_users
				refered_user_count: (refered_users or []).length
