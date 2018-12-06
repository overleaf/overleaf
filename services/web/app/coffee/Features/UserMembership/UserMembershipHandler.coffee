ObjectId = require('mongoose').Types.ObjectId
async = require("async")
Errors = require('../Errors/Errors')
EntityModels =
	Institution: require('../../models/Institution').Institution
	Subscription: require('../../models/Subscription').Subscription
	Publisher: require('../../models/Publisher').Publisher
UserMembershipViewModel = require('./UserMembershipViewModel')
UserGetter = require('../User/UserGetter')
logger = require('logger-sharelatex')
UserMembershipEntityConfigs = require "./UserMembershipEntityConfigs"

module.exports =
	getEntity: (entityId, entityConfig, loggedInUser, callback = (error, entity) ->) ->
		query = buildEntityQuery(entityId, entityConfig)
		unless loggedInUser.isAdmin
			query[entityConfig.fields.access] = ObjectId(loggedInUser._id)
		EntityModels[entityConfig.modelName].findOne query, callback

	getEntityWithoutAuthorizationCheck: (entityId, entityConfig, callback = (error, entity) ->) ->
		query = buildEntityQuery(entityId, entityConfig)
		EntityModels[entityConfig.modelName].findOne query, callback

	createEntity: (entityId, entityConfig, callback = (error, entity) ->) ->
		data = buildEntityQuery(entityId, entityConfig)
		EntityModels[entityConfig.modelName].create data, callback

	getUsers: (entity, entityConfig, callback = (error, users) ->) ->
		attributes = entityConfig.fields.read
		getPopulatedListOfMembers(entity, attributes, callback)

	addUser: (entity, entityConfig, email, callback = (error, user) ->) ->
		attribute = entityConfig.fields.write
		UserGetter.getUserByAnyEmail email, (error, user) ->
			return callback(error) if error?
			unless user
				return callback(userNotFound: true)
			if entity[attribute].some((managerId) -> managerId.equals(user._id))
				return callback(alreadyAdded: true)

			addUserToEntity entity, attribute, user, (error) ->
				callback(error, UserMembershipViewModel.build(user))

	removeUser: (entity, entityConfig, userId, callback = (error) ->) ->
		attribute = entityConfig.fields.write
		if entity.admin_id?.equals(userId)
			return callback(isAdmin: true)
		removeUserFromEntity entity, attribute, userId, callback

	getEntitiesByUser: (entityConfig, userId, callback = (error, entities) ->) ->
		query = Object.assign({}, entityConfig.baseQuery)
		query[entityConfig.fields.access] = userId
		EntityModels[entityConfig.modelName].find query, (error, entities = []) ->
			return callback(error) if error?
			async.mapSeries entities,
				(entity, cb) -> entity.fetchV1Data(cb),
				callback

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

buildEntityQuery = (entityId, entityConfig, loggedInUser) ->
	entityId = ObjectId(entityId) if ObjectId.isValid(entityId.toString())
	query = Object.assign({}, entityConfig.baseQuery)
	query[entityConfig.fields.primaryKey] = entityId
	query
