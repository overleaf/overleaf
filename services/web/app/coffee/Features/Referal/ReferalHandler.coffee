User = require('../../models/User').User

module.exports =
	getReferedUsers: (user_id, callback)->
		User.findById user_id, (err, user)->
			refered_users = user.refered_users || []
			refered_user_count= user.refered_user_count || refered_users.length
			callback null, refered_users, refered_user_count
