SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
logger = require("logger-sharelatex")
SubscriptionLocator = require("./SubscriptionLocator")
ErrorsController = require("../Errors/ErrorController")
SubscriptionDomainHandler = require("./SubscriptionDomainHandler")
AuthenticationController = require('../Authentication/AuthenticationController')
_ = require("underscore")
async = require("async")

module.exports =

	addUserToGroup: (req, res)->
		adminUserId = AuthenticationController.getLoggedInUserId(req)
		newEmail = req.body?.email?.toLowerCase()?.trim()
		logger.log adminUserId:adminUserId, newEmail:newEmail, "adding user to group subscription"
		SubscriptionGroupHandler.addUserToGroup adminUserId, newEmail, (err, user)->
			if err?
				logger.err err:err, newEmail:newEmail, adminUserId:adminUserId, "error adding user from group"
				return res.sendStatus 500
			result =
				user:user
			if err and err.limitReached
				result.limitReached = true
			res.json(result)

	removeUserFromGroup: (req, res)->
		adminUserId = AuthenticationController.getLoggedInUserId(req)
		userToRemove_id = req.params.user_id
		logger.log adminUserId:adminUserId, userToRemove_id:userToRemove_id, "removing user from group subscription"
		SubscriptionGroupHandler.removeUserFromGroup adminUserId, userToRemove_id, (err)->
			if err?
				logger.err err:err, adminUserId:adminUserId, userToRemove_id:userToRemove_id, "error removing user from group"
				return res.sendStatus 500
			res.send()

	removeSelfFromGroup: (req, res)->
		adminUserId = req.query.admin_user_id
		userToRemove_id = AuthenticationController.getLoggedInUserId(req)
		logger.log adminUserId:adminUserId, userToRemove_id:userToRemove_id, "removing user from group subscription after self request"
		SubscriptionGroupHandler.removeUserFromGroup adminUserId, userToRemove_id, (err)->
			if err?
				logger.err err:err, userToRemove_id:userToRemove_id, adminUserId:adminUserId, "error removing self from group"
				return res.sendStatus 500
			res.send()

	renderSubscriptionGroupAdminPage: (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		SubscriptionLocator.getUsersSubscription user_id, (err, subscription)->
			if !subscription?.groupPlan
				return res.redirect("/user/subscription")
			SubscriptionGroupHandler.getPopulatedListOfMembers user_id, (err, users)->
				res.render "subscriptions/group_admin",
					title: 'group_admin'
					users: users
					subscription: subscription

	exportGroupCsv: (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log user_id: user_id, "exporting group csv"
		SubscriptionLocator.getUsersSubscription user_id, (err, subscription)->
			if !subscription.groupPlan
				return res.redirect("/")
			SubscriptionGroupHandler.getPopulatedListOfMembers user_id, (err, users)->
				groupCsv = ""
				for user in users
					groupCsv += user.email + "\n"
				res.header(
					"Content-Disposition",
					"attachment; filename=Group.csv"
				)
				res.contentType('text/csv')
				res.send(groupCsv)
