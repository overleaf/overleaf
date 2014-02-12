User = require("../../models/User").User
NewsletterManager = require "../../managers/NewsletterManager"
ProjectDeleter = require("../Project/ProjectDeleter")
logger = require("logger-sharelatex")

module.exports =

	deleteUser: (user_id, callback = ()->)->
		if !user_id?
			logger.err "user_id is null when trying to delete user"
			return callback("no user_id")
		User.findById user_id, (err, user)->
			logger.log user:user, "deleting user"
			if err?
				return callback(err)
			NewsletterManager.unsubscribe user, (err)->
				if err?
					return callback(err)
				ProjectDeleter.deleteUsersProjects user._id, (err)->
					if err?
						return callback(err)
					user.remove callback
