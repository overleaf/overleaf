async = require("async")
_ = require("underscore")
SubscriptionUpdater = require("./SubscriptionUpdater")
SubscriptionLocator = require("./SubscriptionLocator")
UserGetter = require("../User/UserGetter")
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
			UserGetter.getUserByMainEmail newEmail, (err, user)->
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
					TeamInvitesHandler.createManagerInvite adminUserId, newEmail, (err) ->
						return callback(err) if err?
						userViewModel = buildEmailInviteViewModel(newEmail)
						callback(err, userViewModel)

	removeUserFromGroup: (adminUser_id, userToRemove_id, callback)->
		SubscriptionUpdater.removeUserFromGroup adminUser_id, userToRemove_id, callback

	getPopulatedListOfMembers: (adminUser_id, callback)->
		SubscriptionLocator.getUsersSubscription adminUser_id, (err, subscription)->
			return callback(err) if err?

			users = []

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
