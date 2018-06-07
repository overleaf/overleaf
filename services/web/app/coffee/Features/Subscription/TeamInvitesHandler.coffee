logger = require("logger-sharelatex")
crypto = require("crypto")
async = require("async")

settings = require("settings-sharelatex")
ObjectId = require("mongojs").ObjectId

TeamInvite = require("../../models/TeamInvite").TeamInvite
Subscription = require("../../models/Subscription").Subscription

UserGetter = require("../User/UserGetter")
SubscriptionLocator = require("./SubscriptionLocator")
SubscriptionUpdater = require("./SubscriptionUpdater")
LimitationsManager = require("./LimitationsManager")

EmailHandler = require("../Email/EmailHandler")

module.exports = TeamInvitesHandler =
	getInvite: (token, callback) ->
		Subscription.findOne 'teamInvites.token': token, (err, subscription) ->
			return callback(err) if err?
			return callback(teamNotFound: true) unless subscription?

			invite = subscription.teamInvites.find (i) -> i.token == token
			return callback(null, invite, subscription)

	createInvite: (teamManagerId, email, callback) ->
		logger.log {teamManagerId, email}, "Creating manager team invite"
		UserGetter.getUser teamManagerId, (error, teamManager) ->
			return callback(error) if error?

			SubscriptionLocator.getUsersSubscription teamManagerId, (error, subscription) ->
				return callback(error) if error?

				if teamManager.first_name and teamManager.last_name
					inviterName = "#{teamManager.first_name} #{teamManager.last_name} (#{teamManager.email})"
				else
					inviterName = teamManager.email

				createInvite(subscription, email, inviterName, callback)

	createDomainInvite: (user, licence, callback) ->
		logger.log {licence, email: user.email}, "Creating domain team invite"
		inviterName = licence.name.replace(/\s+licence$/i, licence.name)

		SubscriptionLocator.getSubscription licence.subscription_id, (error, subscription) ->
			return callback(error) if error?
			createInvite(subscription, user.email, inviterName, callback)

	acceptInvite: (token, userId, callback) ->
		logger.log {userId}, "Accepting invite"
		TeamInvitesHandler.getInvite token, (err, invite, subscription) ->
			return callback(err) if err?
			return callback(inviteNoLongerValid: true) unless invite?

			SubscriptionUpdater.addUserToGroup subscription.admin_id, userId, (err) ->
				return callback(err) if err?

				removeInviteFromTeam(subscription.id, invite.email, callback)

	revokeInvite: (teamManagerId, email, callback) ->
		logger.log {teamManagerId, email}, "Revoking invite"
		SubscriptionLocator.getUsersSubscription teamManagerId, (err, teamSubscription) ->
			return callback(err) if err?

			removeInviteFromTeam(teamSubscription.id, email, callback)

	# Legacy method to allow a user to receive a confirmation email if their
	# email is in Subscription.invited_emails when they join. We'll remove this
	# after a short while.
	createTeamInvitesForLegacyInvitedEmail: (email, callback) ->
		SubscriptionLocator.getGroupsWithEmailInvite email, (err, teams) ->
			return callback(err) if err?

			async.map teams,
				(team, cb) -> TeamInvitesHandler.createInvite(team.admin_id, email, cb)
			, callback

createInvite = (subscription, email, inviterName, callback) ->
	logger.log {subscriptionId: subscription.id, email, inviterName}, "Creating invite"
	checkIfInviteIsPossible subscription, email, (error, possible, reason) ->
		return callback(error) if error?
		return callback(reason) unless possible

		# TODO: use standard way to canonalise email addresses
		email = email.trim().toLowerCase()

		invite = subscription.teamInvites.find (invite) -> invite.email == email

		if !invite?
			invite = {
				email: email
				inviterName: inviterName
				token: crypto.randomBytes(32).toString("hex")
				sentAt: new Date()
			}
			subscription.teamInvites.push(invite)
		else
			invite.sentAt = new Date()

		subscription.save (error) ->
			return callback(error) if error?

			opts =
				to: email
				inviterName: inviterName
				acceptInviteUrl: "#{settings.siteUrl}/subscription/invites/#{invite.token}/"
				appName: settings.appName
			EmailHandler.sendEmail "verifyEmailToJoinTeam", opts, (error) ->
				return callback(error, invite)

removeInviteFromTeam = (subscriptionId, email, callback) ->
	searchConditions = { _id: new ObjectId(subscriptionId.toString()) }
	updateOp = { $pull: { teamInvites: { email: email.trim().toLowerCase() } } }

	Subscription.update(searchConditions, updateOp, callback)

checkIfInviteIsPossible = (subscription, email, callback = (error, possible, reason) -> ) ->
	if LimitationsManager.teamHasReachedMemberLimit(subscription)
		logger.log {subscriptionId: subscription.id}, "team has reached member limit"
		return callback(null, false, limitReached: true)

	UserGetter.getUserByAnyEmail email, (error, existingUser) ->
		return callback(error) if error?
		return callback(null, true) unless existingUser?

		existingMember = subscription.member_ids.find (memberId) ->
			memberId.toString() == existingUser._id.toString()

		if existingMember
			logger.log {subscriptionId: subscription.id, email}, "user already in team"
			return callback(null, false, alreadyInTeam: true)
		else
			return callback(null, true)
