logger = require("logger-sharelatex")
crypto = require("crypto")

settings = require("settings-sharelatex")
ObjectId = require("mongojs").ObjectId

TeamInvite = require("../../models/TeamInvite").TeamInvite
Subscription = require("../../models/Subscription").Subscription

UserLocator = require("../User/UserLocator")
SubscriptionLocator = require("./SubscriptionLocator")
SubscriptionUpdater = require("./SubscriptionUpdater")
LimitationsManager = require("./LimitationsManager")

EmailHandler = require("../Email/EmailHandler")

module.exports = TeamInvitesHandler =

	getInvites: (subscriptionId, callback) ->
		TeamInvite.find(subscriptionId: subscriptionId, callback)

	createInvite: (teamManagerId, email, callback) ->
		UserLocator.findById teamManagerId, (error, teamManager) ->
			SubscriptionLocator.getUsersSubscription teamManagerId, (error, subscription) ->
				return callback(error) if error?

				if LimitationsManager.teamHasReachedMemberLimit(subscription)
					return callback(limitReached: true)

				existingInvite = subscription.teamInvites.find (invite) -> invite.email == email

				if existingInvite
					return callback(alreadyInvited: true)

				inviterName = TeamInvitesHandler.inviterName(teamManager)
				token = crypto.randomBytes(32).toString("hex")

				invite = {
					email: email,
					token: token,
					sentAt: new Date(),
				}

				subscription.teamInvites.push(invite)

				subscription.save (error) ->
					return callback(error) if error?

					# TODO: use standard way to canonalise email addresses
					opts =
						to: email.trim().toLowerCase()
						inviterName: inviterName
						acceptInviteUrl: "#{settings.siteUrl}/subscription/invites/#{token}/"
					EmailHandler.sendEmail "verifyEmailToJoinTeam", opts, (error) ->
						return callback(error, invite)

	acceptInvite: (token, userId, callback) ->
		TeamInvitesHandler.getInviteAndManager token, (err, invite, subscription, teamManager) ->
			return callback(err) if err?
			return callback(inviteNoLongerValid: true) unless invite? and teamManager?

			SubscriptionUpdater.addUserToGroup teamManager, userId, (err) ->
				return callback(err) if err?

				TeamInvitesHandler.removeInviteFromTeam(subscription.id, invite.email, callback)

	revokeInvite: (teamManagerId, email, callback) ->
		SubscriptionLocator.getUsersSubscription teamManagerId, (err, teamSubscription) ->
			return callback(err) if err?

			TeamInvitesHandler.removeInviteFromTeam(teamSubscription.id, email, callback)

	getInviteDetails: (token, userId, callback) ->
		TeamInvitesHandler.getInviteAndManager token, (err, invite, teamSubscription, teamManager) ->
			return callback(err) if err?

			SubscriptionLocator.getUsersSubscription userId, (err, personalSubscription) ->
				return callback(err) if err?

				return callback(null , {
					invite: invite,
					personalSubscription: personalSubscription,
					team: teamSubscription,
					inviterName: TeamInvitesHandler.inviterName(teamManager),
					teamManager: teamManager
				})

	getInviteAndManager: (token, callback) ->
		TeamInvitesHandler.getInvite token, (err, invite, teamSubscription) ->
			return callback(err) if err?

			UserLocator.findById teamSubscription.admin_id, (err, teamManager) ->
				return callback(err, invite, teamSubscription, teamManager)

	getInvite: (token, callback) ->
		Subscription.findOne 'teamInvites.token': token, (err, subscription) ->
			return callback(err, subscription) if err?
			return callback(teamNotFound: true) unless subscription?

			invite = subscription.teamInvites.find (i) -> i.token == token
			return callback(null, invite, subscription)


	removeInviteFromTeam: (subscriptionId, email, callback) ->
		searchConditions = { _id: new ObjectId(subscriptionId.toString()) }
		updateOp = { $pull: { teamInvites: { email: email.trim().toLowerCase() } } }

		Subscription.update(searchConditions, updateOp, callback)

	inviterName: (teamManager) ->
		if teamManager.first_name and teamManager.last_name
			"#{teamManager.first_name} #{teamManager.last_name} (#{teamManager.email})"
		else
			teamManager.email
