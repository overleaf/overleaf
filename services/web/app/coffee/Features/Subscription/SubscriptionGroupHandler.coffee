async = require("async")
_ = require("underscore")
SubscriptionUpdater = require("./SubscriptionUpdater")
SubscriptionLocator = require("./SubscriptionLocator")
UserGetter = require("../User/UserGetter")
Subscription = require("../../models/Subscription").Subscription
LimitationsManager = require("./LimitationsManager")
logger = require("logger-sharelatex")
OneTimeTokenHandler = require("../Security/OneTimeTokenHandler")
EmailHandler = require("../Email/EmailHandler")
settings = require("settings-sharelatex")
NotificationsBuilder = require("../Notifications/NotificationsBuilder")
UserMembershipViewModel = require("../UserMembership/UserMembershipViewModel")

module.exports = SubscriptionGroupHandler =

	removeUserFromGroup: (subscriptionId, userToRemove_id, callback)->
		SubscriptionUpdater.removeUserFromGroup subscriptionId, userToRemove_id, callback

	replaceUserReferencesInGroups: (oldId, newId, callback) ->
		logger.log old_id: oldId, new_id: newId, "replacing user reference in groups"
		Subscription.update {admin_id: oldId}, {admin_id: newId}, (error) ->
			return callback(error) if error?

			replaceInArray Subscription, "manager_ids", oldId, newId, (error) ->
				return callback(error) if error?

				replaceInArray Subscription, "member_ids", oldId, newId, callback

	isUserPartOfGroup: (user_id, subscription_id, callback=(err, partOfGroup)->)->
		SubscriptionLocator.getSubscriptionByMemberIdAndId user_id, subscription_id, (err, subscription)->
			if subscription?
				partOfGroup = true
			else
				partOfGroup = false
			logger.log user_id:user_id, subscription_id:subscription_id, partOfGroup:partOfGroup, "checking if user is part of a group"
			callback(err, partOfGroup)

	getTotalConfirmedUsersInGroup: (subscription_id, callback=(err, totalUsers)->)->
		SubscriptionLocator.getSubscription subscription_id, (err, subscription)->
			callback(err, subscription?.member_ids?.length)

replaceInArray = (model, property, oldValue, newValue, callback) ->
	logger.log "Replacing #{oldValue} with #{newValue} in #{property} of #{model}"

	# Mongo won't let us pull and addToSet in the same query, so do it in
	# two. Note we need to add first, since the query is based on the old user.
	query = {}
	query[property] = oldValue

	setNewValue = {}
	setNewValue[property] = newValue

	setOldValue = {}
	setOldValue[property] = oldValue

	model.update query, { $addToSet: setNewValue }, { multi: true }, (error) ->
		return callback(error) if error?
		model.update query, { $pull: setOldValue }, { multi: true }, callback
