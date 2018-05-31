SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
logger = require("logger-sharelatex")
SubscriptionLocator = require("./SubscriptionLocator")
ErrorsController = require("../Errors/ErrorController")
SubscriptionDomainHandler = require("./SubscriptionDomainHandler")
AuthenticationController = require('../Authentication/AuthenticationController')
async = require("async")

module.exports =
	newInvite: (req, res)->
		group_subscription_id = req.params.subscription_id
		user_id = AuthenticationController.getLoggedInUserId(req)
		licence = SubscriptionDomainHandler.findDomainLicenceBySubscriptionId(group_subscription_id)
		if !licence?
			return ErrorsController.notFound(req, res)
		jobs =
			partOfGroup: (cb)->
				SubscriptionGroupHandler.isUserPartOfGroup user_id, licence.group_subscription_id, cb
			subscription: (cb)->
				SubscriptionLocator.getUsersSubscription user_id, cb
		async.series jobs, (err, results)->
			{partOfGroup, subscription} = results
			if partOfGroup
				return res.redirect("/user/subscription/custom_account")
			else
				res.render "subscriptions/group/join",
					title: "Group Invitation"
					group_subscription_id:group_subscription_id
					licenceName:licence.name
					has_personal_subscription: subscription?

	createInvite: (req, res)->
		subscription_id = req.params.subscription_id
		currentUser = AuthenticationController.getSessionUser(req)
		if !currentUser?
			logger.err {subscription_id}, "error getting current user"
			return res.sendStatus 500
		licence = SubscriptionDomainHandler.findDomainLicenceBySubscriptionId(subscription_id)
		if !licence?
			return ErrorsController.notFound(req, res)
		SubscriptionGroupHandler.sendVerificationEmail subscription_id, licence.name, currentUser.email, (err)->
			if err?
				res.sendStatus 500
			else
				res.sendStatus 200
