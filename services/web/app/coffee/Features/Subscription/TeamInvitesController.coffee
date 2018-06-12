settings = require "settings-sharelatex"
logger = require("logger-sharelatex")
TeamInvitesHandler = require('./TeamInvitesHandler')
AuthenticationController = require("../Authentication/AuthenticationController")
SubscriptionLocator = require("./SubscriptionLocator")
ErrorController = require("../Errors/ErrorController")
EmailHelper = require("../Helpers/EmailHelper")

module.exports =
	createInvite: (req, res, next) ->
		teamManagerId = AuthenticationController.getLoggedInUserId(req)
		email = EmailHelper.parseEmail(req.body.email)
		if !email?
			return res.sendStatus(400)

		TeamInvitesHandler.createInvite teamManagerId, email, (err, invite) ->
			return next(err) if err?
			inviteView = { user:
				{ email: invite.email, sentAt: invite.sentAt, invite: true }
			}
			res.json inviteView

	viewInvite: (req, res, next) ->
		token = req.params.token
		userId = AuthenticationController.getLoggedInUserId(req)

		TeamInvitesHandler.getInvite token, (err, invite, teamSubscription) ->
			return next(err) if err?

			if !invite
				return ErrorController.notFound(req, res, next)

			SubscriptionLocator.getUsersSubscription userId, (err, personalSubscription) ->
				return next(err) if err?

				res.render "subscriptions/team/invite",
					inviterName: invite.inviterName
					inviteToken: invite.token
					hasPersonalSubscription: personalSubscription?
					appName: settings.appName

	acceptInvite: (req, res, next) ->
		token = req.params.token
		userId = AuthenticationController.getLoggedInUserId(req)

		TeamInvitesHandler.acceptInvite token, userId, (err, results) ->
			return next(err) if err?
			res.sendStatus 204

	revokeInvite: (req, res) ->
		email = EmailHelper.parseEmail(req.params.email)
		teamManagerId = AuthenticationController.getLoggedInUserId(req)
		if !email?
			return res.sendStatus(400)

		TeamInvitesHandler.revokeInvite teamManagerId, email, (err, results) ->
			return next(err) if err?
			res.sendStatus 204
