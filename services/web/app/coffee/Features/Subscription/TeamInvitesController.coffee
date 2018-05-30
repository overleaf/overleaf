logger = require("logger-sharelatex")
TeamInvitesHandler = require('./TeamInvitesHandler')
AuthenticationController = require("../Authentication/AuthenticationController")

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

	viewInvite: (req, res) ->
		token = request.params.token

		TeamInvitesHandler.getInvite token, (err, invite) ->
			next(err) if err?

			res.render "referal/bonus",
				title: "bonus_please_recommend_us"
				refered_users: refered_users
				refered_user_count: (refered_users or []).length

	acceptInvite: (req, res) ->

	revokeInvite: (req, res) ->
