SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
logger = require("logger-sharelatex")
SubscriptionLocator = require("./SubscriptionLocator")
ErrorsController = require("../Errors/ErrorController")
SubscriptionDomainHandler = require("./SubscriptionDomainHandler")
AuthenticationController = require('../Authentication/AuthenticationController')
_ = require("underscore")
async = require("async")

module.exports =

	removeUserFromGroup: (req, res, next)->
		adminUserId = AuthenticationController.getLoggedInUserId(req)
		userToRemove_id = req.params.user_id
		getManagedSubscription adminUserId, (error, subscription) ->
			return next(error) if error?
			logger.log adminUserId:adminUserId, userToRemove_id:userToRemove_id, "removing user from group subscription"
			SubscriptionGroupHandler.removeUserFromGroup subscription._id, userToRemove_id, (err)->
				if err?
					logger.err err:err, adminUserId:adminUserId, userToRemove_id:userToRemove_id, "error removing user from group"
					return res.sendStatus 500
				res.send()

	removeSelfFromGroup: (req, res, next)->
		adminUserId = req.query.admin_user_id
		userToRemove_id = AuthenticationController.getLoggedInUserId(req)
		getManagedSubscription adminUserId, (error, subscription) ->
			return next(error) if error?
			logger.log adminUserId:adminUserId, userToRemove_id:userToRemove_id, "removing user from group subscription after self request"
			SubscriptionGroupHandler.removeUserFromGroup subscription._id, userToRemove_id, (err)->
				if err?
					logger.err err:err, userToRemove_id:userToRemove_id, adminUserId:adminUserId, "error removing self from group"
					return res.sendStatus 500
				res.send()

	exportGroupCsv: (req, res, next)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log user_id: user_id, "exporting group csv"
		getManagedSubscription user_id, (err, subscription)->
			return next(error) if error?
			if !subscription.groupPlan
				return res.redirect("/")
			SubscriptionGroupHandler.getPopulatedListOfMembers subscription._id, (err, users)->
				groupCsv = ""
				for user in users
					groupCsv += user.email + "\n"
				res.header(
					"Content-Disposition",
					"attachment; filename=Group.csv"
				)
				res.contentType('text/csv')
				res.send(groupCsv)

	# legacy route
	redirectToSubscriptionGroupAdminPage: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req)
		getManagedSubscription user_id, (error, subscription) ->
			return next(error) if error?
			if !subscription?.groupPlan
				return res.redirect("/user/subscription")
			res.redirect("/manage/groups/#{subscription._id}/members")

getManagedSubscription = (managerId, callback) ->
	SubscriptionLocator.findManagedSubscription managerId, (err, subscription)->
		if subscription?
			logger.log managerId: managerId, "got managed subscription"
		else
			err ||= new Error("No subscription found managed by user #{managerId}")

		return callback(err, subscription)
