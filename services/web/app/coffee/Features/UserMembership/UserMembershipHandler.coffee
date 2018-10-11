async = require("async")
Errors = require('../Errors/Errors')
SubscriptionLocator = require('../Subscription/SubscriptionLocator')
InstitutionsLocator = require('../Institutions/InstitutionsLocator')
UserMembershipViewModel = require('./UserMembershipViewModel')
UserGetter = require('../User/UserGetter')
logger = require('logger-sharelatex')

module.exports =
	getEntity: (entityName, userId, callback = (error, entity) ->) ->
		switch entityName
			when 'group' then getGroupSubscription(userId, callback)
			when 'groupManagers'
				getGroupSubscription userId, (error, subscription) ->
					subscription.membersLimit = null if subscription # managers are unlimited
					callback(error, subscription)
			when 'institution' then getInstitution(userId, callback)
			else callback(new Errors.NotFoundError("No such entity: #{entityName}"))

	getUsers: (entityName, entity, callback = (error, users) ->) ->
		attributes = switch entityName
			when 'group' then ['invited_emails', 'teamInvites', 'member_ids']
			when 'groupManagers' then ['manager_ids']
			when 'institution' then ['managerIds']
		getPopulatedListOfMembers(entity, attributes, callback)

	addUser: (entityName, entity, email, callback = (error, user) ->) ->
		attribute = switch entityName
			when 'groupManagers' then 'manager_ids'
			when 'institution' then 'managerIds'
		unless attribute
			return callback(new Errors.NotFoundError("Cannot add user to entity: #{entityName}"))
		UserGetter.getUserByAnyEmail email, (error, user) ->
			error ||= new Errors.NotFoundError("No user found with email #{email}") unless user
			return callback(error) if error?
			addUserToEntity entity, attribute, user, (error) ->
				callback(error, UserMembershipViewModel.build(user))

	removeUser: (entityName, entity, userId, callback = (error) ->) ->
		attribute = switch entityName
			when 'groupManagers' then 'manager_ids'
			when 'institution' then 'managerIds'
			else callback(new Errors.NotFoundError("Cannot remove user from entity: #{entityName}"))
		removeUserFromEntity entity, attribute, userId, callback

getGroupSubscription = (managerId, callback = (error, subscription) ->) ->
	SubscriptionLocator.findManagedSubscription managerId, (err, subscription)->
		if subscription? and subscription.groupPlan
			logger.log managerId: managerId, 'got managed subscription'
		else
			err ||= new Errors.NotFoundError("No subscription found managed by user #{managerId}")

		callback(err, subscription)

getInstitution = (managerId, callback = (error, institution) ->) ->
	InstitutionsLocator.findManagedInstitution managerId, (err, institution)->
		if institution?
			logger.log managerId: managerId, 'got managed subscription'
		else
			err ||= new Errors.NotFoundError("No institution found managed by user #{managerId}")

		callback(err, institution)

getPopulatedListOfMembers = (entity, attributes, callback = (error, users)->)->
		userObjects = []

		for attribute in attributes
			for userObject in entity[attribute] or []
				# userObject can be an email as String, a user id as ObjectId or an
				# invite as Object with an email attribute as String. We want to pass to
				# UserMembershipViewModel either an email as (String) or a user id (ObjectId)
				userIdOrEmail = userObject.email || userObject
				userObjects.push userIdOrEmail

		async.map userObjects, UserMembershipViewModel.buildAsync, callback

addUserToEntity = (entity, attribute, user, callback = (error)->) ->
	fieldUpdate = {}
	fieldUpdate[attribute] = user._id
	entity.update { $addToSet: fieldUpdate }, callback

removeUserFromEntity = (entity, attribute, userId, callback = (error)->) ->
	fieldUpdate = {}
	fieldUpdate[attribute] = userId
	entity.update { $pull: fieldUpdate }, callback
