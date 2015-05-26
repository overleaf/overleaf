SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
logger = require("logger-sharelatex")
SubscriptionLocator = require("./SubscriptionLocator")

settings = require("settings-sharelatex")
OneTimeTokenHandler = require("../Security/OneTimeTokenHandler")
EmailHandler = require("../Email/EmailHandler")
SubscriptionDomainAllocator = require("./SubscriptionDomainAllocator")

module.exports =

	addUserToGroup: (req, res)->
		adminUserId = req.session.user._id
		newEmail = req.body.email
		logger.log adminUserId:adminUserId, newEmail:newEmail, "adding user to group subscription"
		SubscriptionGroupHandler.addUserToGroup adminUserId, newEmail, (err, user)->
			result = 
				user:user
			if err and err.limitReached
				result.limitReached = true
			res.json(result)

	removeUserFromGroup: (req, res)->
		adminUserId = req.session.user._id
		userToRemove_id = req.params.user_id
		logger.log adminUserId:adminUserId, userToRemove_id:userToRemove_id, "removing user from group subscription"
		SubscriptionGroupHandler.removeUserFromGroup adminUserId, userToRemove_id, ->
			res.send()

	renderSubscriptionGroupAdminPage: (req, res)->
		user_id = req.session.user._id
		SubscriptionLocator.getUsersSubscription user_id, (err, subscription)->
			if !subscription.groupPlan
				return res.redirect("/")
			SubscriptionGroupHandler.getPopulatedListOfMembers user_id, (err, users)->
				res.render "subscriptions/group_admin",
					title: 'group_admin'
					users: users
					subscription: subscription

	renderGroupInvitePage: (req, res)->
		subscription_id = req.params.subscription_id
		licence = SubscriptionDomainAllocator.findDomainLicenceBySubscriptionId(subscription_id)

		res.render "subscriptions/group/invite",
			title: "Group Invitation"
			subscription_id:subscription_id
			licenceName:licence.name

	beginJoinGroup: (req, res)->
		subscription_id = req.params.subscription_id
		user_id = req.session.user._id
		licence = SubscriptionDomainAllocator.findDomainLicenceBySubscriptionId(subscription_id)
		if !licence?
			res.send 500
		OneTimeTokenHandler.getNewToken subscription_id, (err, token)->
			opts =
				to : req.session.user.email
				group_name: licence.name
				completeJoinUrl: "#{settings.siteUrl}/user/subscription/#{subscription_id}/group/complete_join?token=#{token}"
			EmailHandler.sendEmail "completeJoinGroupAccount", opts, ->
				res.send 200

	completeJoin: (req, res)->
		subscription_id = req.params.subscription_id
		OneTimeTokenHandler.getValueFromTokenAndExpire req.query.token, (err, token_subscription_id)->
			console.log token_subscription_id
			if err?  or subscription_id != token_subscription_id
				return res.send 403
			SubscriptionLocator.getSubscription subscription_id, (err, subscription)->
				SubscriptionGroupHandler.addUserToGroup subscription.admin_id, req.user.email, (err, user)->
					res.send "joined"


