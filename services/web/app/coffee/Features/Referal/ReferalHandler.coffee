User = require('../../models/User').User

module.exports =
	getReferedUserIds: (user_id, callback)->
		User.findById user_id, (err, user)->
			refered_users = user.refered_users || []
			callback "null", refered_users