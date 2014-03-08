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

	isCollaboratorLimitReached: (project_id, callback = (error, limit_reached)->) ->
		@allowedNumberOfCollaboratorsInProject project_id, (error, allowed_number) =>
			return callback(error) if error?
			@currentNumberOfCollaboratorsInProject project_id, (error, current_number) =>
				return callback(error) if error?
				if current_number < allowed_number or allowed_number < 0
					callback null, false
				else
					callback null, true

	userHasSubscriptionOrFreeTrial: (user, callback = (err, hasSubscriptionOrTrial, subscription)->) ->
		@userHasSubscription user, (err, hasSubscription, subscription)=>
			@userHasFreeTrial user, (err, hasFreeTrial)=>
				logger.log user_id:user._id, subscription:subscription, hasFreeTrial:hasFreeTrial, hasSubscription:hasSubscription, "checking if user has subscription or free trial"
				callback null, hasFreeTrial or hasSubscription, subscription

	userHasSubscription: (user, callback = (err, hasSubscription, subscription)->) ->
		logger.log user_id:user._id, "checking if user has subscription"
		SubscriptionLocator.getUsersSubscription user._id, (err, subscription)->
			hasValidSubscription = subscription? and subscription.recurlySubscription_id? and subscription?.state != "expired"
			logger.log user:user, hasValidSubscription:hasValidSubscription, subscription:subscription, "checking if user has subscription"
			callback err, hasValidSubscription, subscription

	userHasFreeTrial: (user, callback = (err, hasFreeTrial, subscription)->) ->
		logger.log user_id:user._id, "checking if user has free trial"
		SubscriptionLocator.getUsersSubscription user, (err, subscription)->
			callback err, subscription? and subscription.freeTrial? and subscription.freeTrial.expiresAt?, subscription

	hasGroupMembersLimitReached: (user_id, callback)->
		SubscriptionLocator.getUsersSubscription user_id, (err, subscription)->
			limitReached = subscription.member_ids.length >= subscription.membersLimit
			logger.log user_id:user_id, limitReached:limitReached, currentTotal: subscription.member_ids.length, membersLimit: subscription.membersLimit, "checking if subscription members limit has been reached"

			callback(null, limitReached)

getOwnerOfProject = (project_id, callback)->
	Project.findById project_id, 'owner_ref', (error, project) ->
		return callback(error) if error?
		User.findById project.owner_ref, (error, owner) ->
			callback(error, owner)

