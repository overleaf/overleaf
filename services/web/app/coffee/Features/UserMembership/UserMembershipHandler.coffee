ObjectId = require('mongoose').Types.ObjectId
async = require("async")
Errors = require('../Errors/Errors')
EntityModels =
	Institution: require('../../models/Institution').Institution
	Subscription: require('../../models/Subscription').Subscription
UserMembershipViewModel = require('./UserMembershipViewModel')
UserGetter = require('../User/UserGetter')
logger = require('logger-sharelatex')

module.exports =
	getEntity: (entityId, entityConfig, loggedInUser, callback = (error, entity) ->) ->
		query = Object.assign({}, entityConfig.baseQuery)
		query._id = ObjectId(entityId)
		unless loggedInUser.isAdmin
			query[entityConfig.fields.access] = ObjectId(loggedInUser._id)
		EntityModels[entityConfig.modelName].findOne query, callback

	getUsers: (entity, entityConfig, callback = (error, users) ->) ->
		attributes = entityConfig.fields.read
		getPopulatedListOfMembers(entity, attributes, callback)

	addUser: (entity, entityConfig, email, callback = (error, user) ->) ->
		attribute = entityConfig.fields.write
		UserGetter.getUserByAnyEmail email, (error, user) ->
			error ||= new Errors.NotFoundError("No user found with email #{email}") unless user
			return callback(error) if error?
			addUserToEntity entity, attribute, user, (error) ->
				callback(error, UserMembershipViewModel.build(user))

	removeUser: (entity, entityConfig, userId, callback = (error) ->) ->
		attribute = entityConfig.fields.write
		removeUserFromEntity entity, attribute, userId, callback

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
