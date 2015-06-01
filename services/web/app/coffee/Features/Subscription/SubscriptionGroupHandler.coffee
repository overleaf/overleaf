async = require("async")
_ = require("underscore")
UserCreator = require("../User/UserCreator")
SubscriptionUpdater = require("./SubscriptionUpdater")
SubscriptionLocator = require("./SubscriptionLocator")
UserLocator = require("../User/UserLocator")
LimitationsManager = require("./LimitationsManager")
logger = require("logger-sharelatex")
OneTimeTokenHandler = require("../Security/OneTimeTokenHandler")
EmailHandler = require("../Email/EmailHandler")
settings = require("settings-sharelatex")

module.exports = SubscriptionGroupHandler =

	addUserToGroup: (adminUser_id, newEmail, callback)->
		UserCreator.getUserOrCreateHoldingAccount newEmail, (err, user)->
			LimitationsManager.hasGroupMembersLimitReached adminUser_id, (err, limitReached)->
				if limitReached
					return callback(limitReached:limitReached)
				SubscriptionUpdater.addUserToGroup adminUser_id, user._id, (err)->
					userViewModel = buildUserViewModel(user)
					callback(err, userViewModel)

	removeUserFromGroup: (adminUser_id, userToRemove_id, callback)->
		SubscriptionUpdater.removeUserFromGroup adminUser_id, userToRemove_id, callback


	getPopulatedListOfMembers: (adminUser_id, callback)->
		SubscriptionLocator.getUsersSubscription adminUser_id, (err, subscription)-> 
			users = []
			jobs = _.map subscription.member_ids, (user_id)->
				return (cb)->
					UserLocator.findById user_id, (err, user)->
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


	sendVerificationEmail: (subscription_id, licenceName, email, callback)->
		ONE_DAY_IN_S = 1000 * 60 * 60 * 24
		OneTimeTokenHandler.getNewToken subscription_id, {expiresIn:ONE_DAY_IN_S}, (err, token)->
			opts =
				to : email
				group_name: licenceName
				completeJoinUrl: "#{settings.siteUrl}/user/subscription/#{subscription_id}/group/complete-join?token=#{token}"
			EmailHandler.sendEmail "completeJoinGroupAccount", opts, callback

	processGroupVerification: (userEmail, subscription_id, token, callback)->
		OneTimeTokenHandler.getValueFromTokenAndExpire token, (err, token_subscription_id)->
			
			if err?  or subscription_id != token_subscription_id
				logger.err userEmail:userEmail, token:token, "token value not found for processing group verification"
				return callback("token_not_found")
			SubscriptionLocator.getSubscription subscription_id, (err, subscription)->
				SubscriptionGroupHandler.addUserToGroup subscription.admin_id, userEmail, callback


buildUserViewModel = (user)->
	u = 
		email: user.email
		first_name: user.first_name
		last_name: user.last_name
		holdingAccount: user.holdingAccount
		_id: user._id
	return u
