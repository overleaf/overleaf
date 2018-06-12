async = require("async")
_ = require("underscore")
SubscriptionUpdater = require("./SubscriptionUpdater")
SubscriptionLocator = require("./SubscriptionLocator")
UserGetter = require("../User/UserGetter")
Subscription = require("../../models/Subscription").Subscription
LimitationsManager = require("./LimitationsManager")
logger = require("logger-sharelatex")
OneTimeTokenHandler = require("../Security/OneTimeTokenHandler")
TeamInvitesHandler = require("./TeamInvitesHandler")
EmailHandler = require("../Email/EmailHandler")
settings = require("settings-sharelatex")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")

module.exports = SubscriptionGroupHandler =

	addUserToGroup: (adminUserId, newEmail, callback)->
		logger.log adminUserId:adminUserId, newEmail:newEmail, "adding user to group"
		LimitationsManager.hasGroupMembersLimitReached adminUserId, (err, limitReached, subscription)->
			if err?
				logger.err err:err, adminUserId:adminUserId, newEmail:newEmail, "error checking if limit reached for group plan"
				return callback(err)
			if limitReached
				logger.err adminUserId:adminUserId, newEmail:newEmail, "group subscription limit reached not adding user to group"
				return callback(limitReached:limitReached)
			UserGetter.getUserByAnyEmail newEmail, (err, user)->
				return callback(err) if err?
				if user?
					SubscriptionUpdater.addUserToGroup adminUserId, user._id, (err)->
						if err?
							logger.err err:err, "error adding user to group"
							return callback(err)
						NotificationsBuilder.groupPlan(user, {subscription_id:subscription._id}).read()
						userViewModel = buildUserViewModel(user)
						callback(err, userViewModel)
				else
					TeamInvitesHandler.createInvite adminUserId, newEmail, (err) ->
						return callback(err) if err?
						userViewModel = buildEmailInviteViewModel(newEmail)
						callback(err, userViewModel)

	removeUserFromGroup: (adminUser_id, userToRemove_id, callback)->
		SubscriptionUpdater.removeUserFromGroup adminUser_id, userToRemove_id, callback

	replaceUserReferencesInGroups: (oldId, newId, callback) ->
		Subscription.update {admin_id: oldId}, {admin_id: newId}, (error) ->
			callback(error) if error?

			# Mongo won't let us pull and addToSet in the same query, so do it in
			# two. Note we need to add first, since the query is based on the old user.
			query = { member_ids: oldId }
			addNewUserUpdate = $addToSet: { member_ids: newId }
			removeOldUserUpdate =  $pull: { member_ids: oldId }

			Subscription.update query, addNewUserUpdate, { multi: true }, (error) ->
				return callback(error) if error?
				Subscription.update query, removeOldUserUpdate, { multi: true }, callback

	getPopulatedListOfMembers: (adminUser_id, callback)->
		SubscriptionLocator.getUsersSubscription adminUser_id, (err, subscription)->
			users = []

			for email in subscription.invited_emails or []
				users.push buildEmailInviteViewModel(email)

			for teamInvite in subscription.teamInvites or []
				users.push buildEmailInviteViewModel(teamInvite.email)

			jobs = _.map subscription.member_ids, (user_id)->
				return (cb)->
					UserGetter.getUser user_id, (err, user)->
						if err? or !user?
							users.push _id:user_id
							return cb()
						userViewModel = buildUserViewModel(user)
						users.push(userViewModel)
						cb()
			async.series jobs, (err)->
				callback(err, users)

	isUserPartOfGroup: (user_id, subscription_id, callback=(err, partOfGroup)->)->
		SubscriptionLocator.getSubscriptionByMemberIdAndId user_id, subscription_id, (err, subscription)->
			if subscription?
				partOfGroup = true
			else
				partOfGroup = false
			logger.log user_id:user_id, subscription_id:subscription_id, partOfGroup:partOfGroup, "checking if user is part of a group"
			callback(err, partOfGroup)

buildUserViewModel = (user)->
	u =
		email: user.email
		first_name: user.first_name
		last_name: user.last_name
		invite: user.holdingAccount
		_id: user._id
	return u

buildEmailInviteViewModel = (email) ->
	return {
		email: email
		invite: true
	}
