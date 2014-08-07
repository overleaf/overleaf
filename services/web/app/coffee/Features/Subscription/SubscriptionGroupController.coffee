SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
logger = require("logger-sharelatex")
SubscriptionLocator = require("./SubscriptionLocator")

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
