logger = require("logger-sharelatex")
ProjectGetter = require('../Project/ProjectGetter')
UserGetter = require("../User/UserGetter")
SubscriptionLocator = require("./SubscriptionLocator")
Settings = require("settings-sharelatex")
CollaboratorsHandler = require("../Collaborators/CollaboratorsHandler")
CollaboratorsInvitesHandler = require("../Collaborators/CollaboratorsInviteHandler")
V1SubscriptionManager = require("./V1SubscriptionManager")

module.exports = LimitationsManager =
	allowedNumberOfCollaboratorsInProject: (project_id, callback) ->
		ProjectGetter.getProject project_id, owner_ref: true, (error, project) =>
			return callback(error) if error?
			@allowedNumberOfCollaboratorsForUser project.owner_ref, callback

	allowedNumberOfCollaboratorsForUser: (user_id, callback) ->
		UserGetter.getUser user_id, {features: 1}, (error, user) ->
			return callback(error) if error?
			if user.features? and user.features.collaborators?
				callback null, user.features.collaborators
			else
				callback null, Settings.defaultFeatures.collaborators

	canAddXCollaborators: (project_id, x_collaborators, callback = (error, allowed)->) ->
		@allowedNumberOfCollaboratorsInProject project_id, (error, allowed_number) =>
			return callback(error) if error?
			CollaboratorsHandler.getInvitedCollaboratorCount project_id, (error, current_number) =>
				return callback(error) if error?
				CollaboratorsInvitesHandler.getInviteCount project_id, (error, invite_count) =>
					return callback(error) if error?
					if current_number + invite_count + x_collaborators <= allowed_number or allowed_number < 0
						callback null, true
					else
						callback null, false

	hasPaidSubscription: (user, callback = (err, hasSubscriptionOrIsMember)->) ->
		@userHasV2Subscription user, (err, hasSubscription, subscription)=>
			return callback(err) if err?
			@userIsMemberOfGroupSubscription user, (err, isMember)=>
				return callback(err) if err?
				@userHasV1Subscription user, (err, hasV1Subscription)=>
					return callback(err) if err?
					logger.log {user_id:user._id, isMember, hasSubscription, hasV1Subscription}, "checking if user has subscription or is group member"
					callback err, isMember or hasSubscription or hasV1Subscription, subscription


	# alias for backward-compatibility with modules. Use `haspaidsubscription` instead
	userHasSubscriptionOrIsGroupMember: (user, callback) ->
		@hasPaidSubscription(user, callback)

	userHasV2Subscription: (user, callback = (err, hasSubscription, subscription)->) ->
		logger.log user_id:user._id, "checking if user has subscription"
		SubscriptionLocator.getUsersSubscription user._id, (err, subscription)->
			if err?
				return callback(err)
			hasValidSubscription = subscription? and (subscription.recurlySubscription_id? or subscription?.customAccount == true)
			logger.log user:user, hasValidSubscription:hasValidSubscription, subscription:subscription, "checking if user has subscription"
			callback err, hasValidSubscription, subscription

	userHasV1OrV2Subscription: (user, callback = (err, hasSubscription) ->) ->
		@userHasV2Subscription user, (err, hasV2Subscription) =>
			return callback(err) if err?
			return callback null, true if hasV2Subscription
			@userHasV1Subscription user, (err, hasV1Subscription) =>
				return callback(err) if err?
				return callback null, true if hasV1Subscription
				return callback null, false

	userIsMemberOfGroupSubscription: (user, callback = (error, isMember, subscriptions) ->) ->
		logger.log user_id: user._id, "checking is user is member of subscription groups"
		SubscriptionLocator.getMemberSubscriptions user._id, (err, subscriptions = []) ->
			return callback(err) if err?
			callback err, subscriptions.length > 0, subscriptions

	userHasV1Subscription: (user, callback = (error, hasV1Subscription) ->) ->
		V1SubscriptionManager.getSubscriptionsFromV1 user._id, (err, v1Subscription) ->
			logger.log {user_id: user._id, v1Subscription}, '[userHasV1Subscription]'
			callback err, !!v1Subscription?.has_subscription

	teamHasReachedMemberLimit: (subscription) ->
		currentTotal = (subscription.member_ids or []).length +
			(subscription.teamInvites or []).length +
			(subscription.invited_emails or []).length

		return currentTotal >= subscription.membersLimit

	hasGroupMembersLimitReached: (subscriptionId, callback = (err, limitReached, subscription)->)->
		SubscriptionLocator.getSubscription subscriptionId, (err, subscription)->
			if err?
				logger.err err:err, subscriptionId: subscriptionId, "error getting subscription"
				return callback(err)
			if !subscription?
				logger.err subscriptionId: subscriptionId, "no subscription found"
				return callback("no subscription found")

			limitReached = LimitationsManager.teamHasReachedMemberLimit(subscription)
			callback(err, limitReached, subscription)
