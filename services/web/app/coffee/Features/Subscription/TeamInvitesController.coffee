logger = require("logger-sharelatex")
TeamInvitesHandler = require('./TeamInvitesHandler')
AuthenticationController = require("../Authentication/AuthenticationController")
ErrorController = require("../Errors/ErrorController")

module.exports =
	createInvite: (req, res, next) ->
		adminUserId = AuthenticationController.getLoggedInUserId(req)
		email   = req.body.email

		TeamInvitesHandler.createInvite adminUserId, email, (err, invite) ->
			next(err) if err?
			inviteView = { user:
				{ email: invite.email, sentAt: invite.sentAt, holdingAccount: true }
			}
			res.json inviteView

	viewInvite: (req, res, next) ->
		token = req.params.token
		userId = AuthenticationController.getLoggedInUserId(req)

		TeamInvitesHandler.getInviteDetails token, userId, (err, results) ->
			next(err) if err?

			{ invite, personalSubscription, inviterName } = results

			unless invite?
				return ErrorController.notFound(req, res, next)

			res.render "subscriptions/group/team_invite",
				inviterName: inviterName
				inviteToken: invite.token
				hasPersonalSubscription: personalSubscription?


	acceptInvite: (req, res) ->

	revokeInvite: (req, res) ->
