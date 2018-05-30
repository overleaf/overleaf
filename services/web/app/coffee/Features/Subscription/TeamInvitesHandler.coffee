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

				inviterName = "#{groupAdmin.first_name} #{groupAdmin.last_name}"
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


	acceptInvite: (userId, token, callback) ->

	revokeInvite: (token, callback) ->
