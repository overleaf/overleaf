settings = require "settings-sharelatex"
logger = require("logger-sharelatex")
TeamInvitesHandler = require('./TeamInvitesHandler')
AuthenticationController = require("../Authentication/AuthenticationController")
SubscriptionLocator = require("./SubscriptionLocator")
ErrorController = require("../Errors/ErrorController")

module.exports =
	createInvite: (req, res, next) ->
		teamManagerId = AuthenticationController.getLoggedInUserId(req)
		email   = req.body.email

		TeamInvitesHandler.createInvite teamManagerId, email, (err, invite) ->
			next(err) if err?
			inviteView = { user:
				{ email: invite.email, sentAt: invite.sentAt, holdingAccount: true }
			}
			res.json inviteView

	viewInvite: (req, res, next) ->
		token = req.params.token
		userId = AuthenticationController.getLoggedInUserId(req)

		TeamInvitesHandler.getInvite token, (err, invite, teamSubscription) ->
			next(err) if err?

			unless invite?
				return ErrorController.notFound(req, res, next)

			SubscriptionLocator.getUsersSubscription userId, (err, personalSubscription) ->
				return callback(err) if err?

				res.render "subscriptions/team/invite",
					inviterName: invite.inviterName
					inviteToken: invite.token
					hasPersonalSubscription: personalSubscription?
					appName: settings.appName


	acceptInvite: (req, res, next) ->
		token = req.params.token
		userId = AuthenticationController.getLoggedInUserId(req)

		TeamInvitesHandler.acceptInvite token, userId, (err, results) ->
			next(err) if err?

		res.sendStatus 204

	revokeInvite: (req, res) ->
		email = req.params.email
		teamManagerId = AuthenticationController.getLoggedInUserId(req)

		TeamInvitesHandler.revokeInvite teamManagerId, email, (err, results) ->
			next(err) if err?

			res.sendStatus 204
