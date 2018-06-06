SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
logger = require("logger-sharelatex")
SubscriptionLocator = require("./SubscriptionLocator")
ErrorsController = require("../Errors/ErrorController")
SubscriptionDomainHandler = require("./SubscriptionDomainHandler")
AuthenticationController = require('../Authentication/AuthenticationController')
TeamInvitesHandler = require('./TeamInvitesHandler')

async = require("async")

module.exports =
	join: (req, res)->
		user = AuthenticationController.getSessionUser(req)
		licence = SubscriptionDomainHandler.getLicenceUserCanJoin(user)

		if !licence?
			return ErrorsController.notFound(req, res)

		jobs =
			partOfGroup: (cb)->
				SubscriptionGroupHandler.isUserPartOfGroup user.id, licence.group_subscription_id, cb
			subscription: (cb)->
				SubscriptionLocator.getUsersSubscription user.id, cb

		async.series jobs, (err, results)->
			{ partOfGroup, subscription } = results
			if partOfGroup
				return res.redirect("/user/subscription/custom_account")
			else
				res.render "subscriptions/domain/join",
					title: "Group Invitation"
					group_subscription_id: licence.group_subscription_id
					licenceName: licence.name
					has_personal_subscription: subscription?

	createInvite: (req, res, next)->
		user = AuthenticationController.getSessionUser(req)
		licence = SubscriptionDomainHandler.getLicenceUserCanJoin(user)

		if !licence?
			return ErrorsController.notFound(req, res)

		TeamInvitesHandler.createDomainInvite user, licence, (err) ->
			if err?
				next(err)
			else
				res.sendStatus 200
