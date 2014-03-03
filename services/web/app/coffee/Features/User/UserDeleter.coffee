User = require("../../models/User").User
NewsletterManager = require "../../managers/NewsletterManager"
ProjectDeleter = require("../Project/ProjectDeleter")
logger = require("logger-sharelatex")
SubscriptionHandler = require("../Subscription/SubscriptionHandler")
async = require("async")

module.exports =

	deleteUser: (user_id, callback = ()->)->
		if !user_id?
			logger.err "user_id is null when trying to delete user"
			return callback("no user_id")
		User.findById user_id, (err, user)->
			if err?
				return callback(err)
			logger.log user:user, "deleting user"
			async.series [
				(cb)->
					NewsletterManager.unsubscribe user, cb
				(cb)->
					ProjectDeleter.deleteUsersProjects user._id, cb
				(cb)->
					SubscriptionHandler.cancelSubscription user._id, cb
				(cb)->
					user.remove cb
			], (err)->
				if err?
					logger.err err:err, user_id:user_id, "something went wrong deleteing the user"
				callback err
