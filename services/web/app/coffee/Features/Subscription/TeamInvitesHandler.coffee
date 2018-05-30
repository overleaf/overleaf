logger = require("logger-sharelatex")
crypto = require("crypto")

settings = require("settings-sharelatex")

UserLocator = require("../User/UserLocator")
SubscriptionLocator = require("./SubscriptionLocator")
TeamInvite = require("../../models/TeamInvite").TeamInvite
EmailHandler = require("../Email/EmailHandler")

module.exports = TeamInvitesHandler =

	getInvites: (subscriptionId, callback) ->
		TeamInvite.find(subscriptionId: subscriptionId, callback)

	createInvite: (adminUserId, email, callback) ->

		UserLocator.findById adminUserId, (error, groupAdmin) ->
			SubscriptionLocator.getUsersSubscription adminUserId, (error, subscription) ->
				return callback(error) if error?

				inviterName = TeamInvitesHandler.inviterName(groupAdmin)
				token = crypto.randomBytes(32).toString("hex")

				TeamInvite.create {
					subscriptionId: subscription.id,
					email: email,
					token: token,
					sentAt: new Date(),
				}, (error, invite) ->
					return callback(error) if error?
					opts =
						to : email
						inviterName: inviterName
						acceptInviteUrl: "#{settings.siteUrl}/subscription/invites/#{token}/"
					EmailHandler.sendEmail "verifyEmailToJoinTeam", opts, (error) ->
						return callback(error, invite)

	getInvite: (token, callback) ->
		TeamInvite.findOne(token: token, callback)

	acceptInvite: (userId, token, callback) ->

	revokeInvite: (token, callback) ->

	getInviteDetails: (token, userId, callback) ->
		TeamInvitesHandler.getInvite token, (err, invite) ->
			callback(err) if err?

			SubscriptionLocator.getUsersSubscription userId, (err, personalSubscription) ->
				callback(err) if err?

				SubscriptionLocator.getSubscription invite.subscriptionId, (err, teamSubscription) ->
					callback(err) if err?

					UserLocator.findById teamSubscription.admin_id, (err, teamAdmin) ->
						callback(err) if err?

						callback(null , {
							invite: invite,
							personalSubscription: personalSubscription,
							team: teamSubscription,
							inviterName: TeamInvitesHandler.inviterName(teamAdmin),
							teamAdmin: teamAdmin
						})

	inviterName: (groupAdmin) ->
		if groupAdmin.first_name and groupAdmin.last_name
			"#{groupAdmin.first_name} #{groupAdmin.last_name} (#{groupAdmin.email})"
		else
			groupAdmin.email
