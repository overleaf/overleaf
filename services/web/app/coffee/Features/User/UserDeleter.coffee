User = require("../../models/User").User
NewsletterManager = require "../Newsletter/NewsletterManager"
ProjectDeleter = require("../Project/ProjectDeleter")
logger = require("logger-sharelatex")
SubscriptionHandler = require("../Subscription/SubscriptionHandler")
SubscriptionUpdater = require("../Subscription/SubscriptionUpdater")
SubscriptionLocator = require("../Subscription/SubscriptionLocator")
UserMembershipsHandler = require("../UserMembership/UserMembershipsHandler")
async = require("async")
InstitutionsAPI = require("../Institutions/InstitutionsAPI")
Errors = require("../Errors/Errors")
{db, ObjectId} = require("../../infrastructure/mongojs")

module.exports = UserDeleter =

	softDeleteUserForMigration: (user_id, callback = (err)->)->
		if !user_id?
			logger.err "user_id is null when trying to delete user"
			return callback(new Error("no user_id"))
		User.findById user_id, (err, user)->
			return callback(err) if err?
			return callback(new Errors.NotFoundError("user not found")) unless user?
			async.series([
				(cb) ->
					UserDeleter._ensureCanDeleteUser user, cb
				(cb) ->
					UserDeleter._cleanupUser user, cb
				(cb) ->
					ProjectDeleter.deleteUsersProjects user._id, cb
				(cb) ->
					user.deletedAt = new Date()
					db.usersDeletedByMigration.insert user, cb
				(cb) ->
					user.remove cb
			], callback)

	deleteUser: (user_id, callback = ()->)->
		if !user_id?
			logger.err "user_id is null when trying to delete user"
			return callback("no user_id")
		User.findById user_id, (err, user)->
			if err?
				return callback(err)
			logger.log user:user, "deleting user"
			async.series [
				(cb) ->
					UserDeleter._ensureCanDeleteUser user, cb
				(cb)->
					UserDeleter._cleanupUser user, cb
				(cb)->
					ProjectDeleter.deleteUsersProjects user._id, cb
				(cb)->
					user.remove cb
			], (err)->
				if err?
					logger.err err:err, user_id:user_id, "something went wrong deleteing the user"
				callback err

	_cleanupUser: (user, callback) ->
		return callback(new Error("no user supplied")) unless user?
		async.series([
			(cb)->
				NewsletterManager.unsubscribe user, (err) ->
					logger.err("Failed to unsubscribe user from newsletter", user_id: user._id, error: err)
					cb()
			(cb)->
				SubscriptionHandler.cancelSubscription user, cb
			(cb)->
				InstitutionsAPI.deleteAffiliations user._id, cb
			(cb)->
				SubscriptionUpdater.removeUserFromAllGroups user._id, cb
			(cb)->
				UserMembershipsHandler.removeUserFromAllEntities user._id, cb
		], callback)

	_ensureCanDeleteUser: (user, callback) ->
		SubscriptionLocator.getUsersSubscription user, (error, subscription) ->
			if subscription?
				error ||= new Errors.SubscriptionAdminDeletionError()
			callback(error)
