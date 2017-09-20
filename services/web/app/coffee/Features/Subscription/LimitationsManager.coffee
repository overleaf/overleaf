logger = require("logger-sharelatex")
Project = require("../../models/Project").Project
UserGetter = require("../User/UserGetter")
SubscriptionLocator = require("./SubscriptionLocator")
Settings = require("settings-sharelatex")
CollaboratorsHandler = require("../Collaborators/CollaboratorsHandler")
CollaboratorsInvitesHandler = require("../Collaborators/CollaboratorsInviteHandler")

module.exports =
	allowedNumberOfCollaboratorsInProject: (project_id, callback) ->
		Project.findById project_id, 'owner_ref', (error, project) =>
			return callback(error) if error?
			@allowedNumberOfCollaboratorsForUser project.owner_ref, callback
	
	allowedNumberOfCollaboratorsForUser: (user_id, callback) ->
		UserGetter.getUser user_id, {features: 1}, (error, user) ->
			return callback(error) if error?
			if user.features? and user.features.collaborators?
				callback null, user.features.collaborators
			else
				callback null, Settings.defaultPlanCode.collaborators
		

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

	userHasSubscriptionOrIsGroupMember: (user, callback = (err, hasSubscriptionOrIsMember)->) ->
		@userHasSubscription user, (err, hasSubscription, subscription)=>
			return callback(err) if err?
			@userIsMemberOfGroupSubscription user, (err, isMember)=>
				return callback(err) if err?
				logger.log user_id:user._id, isMember:isMember, hasSubscription:hasSubscription, "checking if user has subscription or is group member"
				callback err, isMember or hasSubscription, subscription

	userHasSubscription: (user, callback = (err, hasSubscription, subscription)->) ->
		logger.log user_id:user._id, "checking if user has subscription"
		SubscriptionLocator.getUsersSubscription user._id, (err, subscription)->
			if err?
				return callback(err)
			hasValidSubscription = subscription? and (subscription.recurlySubscription_id? or subscription?.customAccount == true)
			logger.log user:user, hasValidSubscription:hasValidSubscription, subscription:subscription, "checking if user has subscription"
			callback err, hasValidSubscription, subscription

	userIsMemberOfGroupSubscription: (user, callback = (error, isMember, subscriptions) ->) ->
		logger.log user_id: user._id, "checking is user is member of subscription groups"
		SubscriptionLocator.getMemberSubscriptions user._id, (err, subscriptions = []) ->
			return callback(err) if err?
			callback err, subscriptions.length > 0, subscriptions

	hasGroupMembersLimitReached: (user_id, callback = (err, limitReached, subscription)->)->
		SubscriptionLocator.getUsersSubscription user_id, (err, subscription)->
			if err?
				logger.err err:err, user_id:user_id, "error getting users subscription"
				return callback(err)
			if !subscription?
				logger.err user_id:user_id, "no subscription found for user"
				return callback("no subscription found")
			currentTotal = (subscription.member_ids or []).length + (subscription.invited_emails or []).length
			limitReached = currentTotal >= subscription.membersLimit
			logger.log user_id:user_id, limitReached:limitReached, currentTotal: currentTotal, membersLimit: subscription.membersLimit, "checking if subscription members limit has been reached"
			callback(err, limitReached, subscription)

getOwnerIdOfProject = (project_id, callback)->
