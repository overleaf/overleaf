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
EmailHelper = require("../Helpers/EmailHelper")

Errors = require "../Errors/Errors"

module.exports = TeamInvitesHandler =
	getInvite: (token, callback) ->
		Subscription.findOne 'teamInvites.token': token, (err, subscription) ->
			return callback(err) if err?
			return callback(new Errors.NotFoundError('team not found')) unless subscription?

			invite = subscription.teamInvites.find (i) -> i.token == token
			return callback(null, invite, subscription)

	createInvite: (teamManagerId, subscription, email, callback) ->
		email = EmailHelper.parseEmail(email)
		return callback(new Error('invalid email')) if !email?
		logger.log {teamManagerId, email}, "Creating manager team invite"
		UserGetter.getUser teamManagerId, (error, teamManager) ->
			return callback(error) if error?

			if teamManager.first_name and teamManager.last_name
				inviterName = "#{teamManager.first_name} #{teamManager.last_name} (#{teamManager.email})"
			else
				inviterName = teamManager.email

			removeLegacyInvite subscription.id, email, (error) ->
				return callback(error) if error?
				createInvite(subscription, email, inviterName, callback)

	importInvite: (subscription, inviterName, email, token, sentAt, callback) ->
		checkIfInviteIsPossible subscription, email, (error, possible, reason) ->
			return callback(error) if error?
			return callback(reason) unless possible

			subscription.teamInvites.push({
				email: email
				inviterName: inviterName
				token: token
				sentAt: sentAt
			})

			subscription.save callback

	acceptInvite: (token, userId, callback) ->
		logger.log {userId}, "Accepting invite"
		TeamInvitesHandler.getInvite token, (err, invite, subscription) ->
			return callback(err) if err?
			return callback(new Errors.NotFoundError('invite not found')) unless invite?

			SubscriptionUpdater.addUserToGroup subscription._id, userId, (err) ->
				return callback(err) if err?

				removeInviteFromTeam(subscription.id, invite.email, callback)

	revokeInvite: (teamManagerId, subscription, email, callback) ->
		email = EmailHelper.parseEmail(email)
		return callback(new Error('invalid email')) if !email?
		logger.log {teamManagerId, email}, "Revoking invite"
		removeInviteFromTeam(subscription.id, email, callback)

	# Legacy method to allow a user to receive a confirmation email if their
	# email is in Subscription.invited_emails when they join. We'll remove this
	# after a short while.
	createTeamInvitesForLegacyInvitedEmail: (email, callback) ->
		SubscriptionLocator.getGroupsWithEmailInvite email, (err, teams) ->
			return callback(err) if err?

			async.map teams,
				(team, cb) -> TeamInvitesHandler.createInvite(team.admin_id, team, email, cb)
			, callback

createInvite = (subscription, email, inviterName, callback) ->
	logger.log {subscriptionId: subscription.id, email, inviterName}, "Creating invite"
	checkIfInviteIsPossible subscription, email, (error, possible, reason) ->
		return callback(error) if error?
		return callback(reason) unless possible

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
	removeInvite = { $pull: { teamInvites: { email: email } } }
	logger.log {subscriptionId, email, searchConditions, removeInvite}, 'removeInviteFromTeam'

	async.series [
		(cb) -> Subscription.update(searchConditions, removeInvite, cb),
		(cb) -> removeLegacyInvite(subscriptionId, email, cb),
	], callback

removeLegacyInvite = (subscriptionId, email, callback) ->
	Subscription.update({
		_id: new ObjectId(subscriptionId.toString())
	}, {
		$pull: {
			invited_emails: email
		}
	}, callback)

checkIfInviteIsPossible = (subscription, email, callback = (error, possible, reason) -> ) ->
	unless subscription.groupPlan
		logger.log {subscriptionId: subscription.id},
			"can not add members to a subscription that is not in a group plan"
		return callback(null, false, wrongPlan: true)

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
