logger = require("logger-sharelatex")
Project = require("../../models/Project").Project
User = require("../../models/User").User
SubscriptionLocator = require("./SubscriptionLocator")
Settings = require("settings-sharelatex")

module.exports =

	allowedNumberOfCollaboratorsInProject: (project_id, callback) ->
		getOwnerOfProject project_id, (error, owner)->
			return callback(error) if error?
			if owner.features? and owner.features.collaborators?
				callback null, owner.features.collaborators
			else
				callback null, Settings.defaultPlanCode.collaborators
	
	currentNumberOfCollaboratorsInProject: (project_id, callback) ->
		Project.findById project_id, 'collaberator_refs readOnly_refs', (error, project) ->
			return callback(error) if error?
			callback null, (project.collaberator_refs.length + project.readOnly_refs.length)

	canAddXCollaborators: (project_id, x_collaborators, callback = (error, allowed)->) ->
		@allowedNumberOfCollaboratorsInProject project_id, (error, allowed_number) =>
			return callback(error) if error?
			@currentNumberOfCollaboratorsInProject project_id, (error, current_number) =>
				return callback(error) if error?
				if current_number + x_collaborators <= allowed_number or allowed_number < 0
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
			hasValidSubscription = subscription? and subscription.recurlySubscription_id?
			logger.log user:user, hasValidSubscription:hasValidSubscription, subscription:subscription, "checking if user has subscription"
			callback err, hasValidSubscription, subscription
			
	userIsMemberOfGroupSubscription: (user, callback = (error, isMember, subscriptions) ->) ->
		logger.log user_id: user._ud, "checking is user is member of subscription groups"
		SubscriptionLocator.getMemberSubscriptions user._id, (err, subscriptions = []) ->
			return callback(err) if err?
			callback err, subscriptions.length > 0, subscriptions

	hasGroupMembersLimitReached: (user_id, callback)->
		SubscriptionLocator.getUsersSubscription user_id, (err, subscription)->
			limitReached = subscription.member_ids.length >= subscription.membersLimit
			logger.log user_id:user_id, limitReached:limitReached, currentTotal: subscription.member_ids.length, membersLimit: subscription.membersLimit, "checking if subscription members limit has been reached"
			callback(err, limitReached)

getOwnerOfProject = (project_id, callback)->
	Project.findById project_id, 'owner_ref', (error, project) ->
		return callback(error) if error?
		User.findById project.owner_ref, (error, owner) ->
			callback(error, owner)

