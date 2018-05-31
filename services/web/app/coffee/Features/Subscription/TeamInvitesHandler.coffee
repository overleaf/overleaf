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

	getInvite: (token, callback) ->
		Subscription.findOne 'teamInvites.token': token, (err, subscription) ->
			return callback(err, subscription) if err?
			return callback(teamNotFound: true) unless subscription?

			invite = subscription.teamInvites.find (i) -> i.token == token
			return callback(null, invite, subscription)

	createManagerInvite: (teamManagerId, email, callback) ->
		UserLocator.findById teamManagerId, (error, teamManager) ->
			return callback(error) if error?

			SubscriptionLocator.getUsersSubscription teamManagerId, (error, subscription) ->
				return callback(error) if error?

				if teamManager.first_name and teamManager.last_name
					inviterName = "#{teamManager.first_name} #{teamManager.last_name} (#{teamManager.email})"
				else
					inviterName = teamManager.email

				TeamInvitesHandler.createInvite(subscription, email, inviterName, callback)

	createDomainInvite: (user, licence, callback) ->
		SubscriptionLocator.getSubscription licence.subscription_id, (error, subscription) ->
			return callback(error) if error?
			TeamInvitesHandler.createInvite(subscription, user.email, licence.name, callback)

	acceptInvite: (token, userId, callback) ->
		TeamInvitesHandler.getInvite token, (err, invite, subscription) ->
			return callback(err) if err?
			return callback(inviteNoLongerValid: true) unless invite?

			SubscriptionUpdater.addUserToGroup subscription.admin_id, userId, (err) ->
				return callback(err) if err?

				TeamInvitesHandler.removeInviteFromTeam(subscription.id, invite.email, callback)

	revokeInvite: (teamManagerId, email, callback) ->
		SubscriptionLocator.getUsersSubscription teamManagerId, (err, teamSubscription) ->
			return callback(err) if err?

			TeamInvitesHandler.removeInviteFromTeam(teamSubscription.id, email, callback)

	createInvite: (subscription, email, inviterName, callback) ->
		if LimitationsManager.teamHasReachedMemberLimit(subscription)
			return callback(limitReached: true)

		existingInvite = subscription.teamInvites.find (invite) -> invite.email == email

		if existingInvite
			return callback(alreadyInvited: true)

		token = crypto.randomBytes(32).toString("hex")

		invite = {
			email: email,
			token: token,
			inviterName: inviterName,
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

	removeInviteFromTeam: (subscriptionId, email, callback) ->
		searchConditions = { _id: new ObjectId(subscriptionId.toString()) }
		updateOp = { $pull: { teamInvites: { email: email.trim().toLowerCase() } } }

		Subscription.update(searchConditions, updateOp, callback)
