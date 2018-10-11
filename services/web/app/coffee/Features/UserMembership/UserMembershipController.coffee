AuthenticationController = require('../Authentication/AuthenticationController')
UserMembershipHandler = require('./UserMembershipHandler')
EntityConfigs = require('./UserMembershipEntityConfigs')
Errors = require('../Errors/Errors')
logger = require("logger-sharelatex")

module.exports =
	index: (entityName, req, res, next)->
		getEntity entityName, req, (error, entity, entityConfig) ->
			return next(error) if error?
			UserMembershipHandler.getUsers entity, entityConfig, (error, users)->
				return next(error) if error?
				res.render "user_membership/index",
					users: users
					groupSize: entity.membersLimit if entityConfig.hasMembersLimit
					translations: entityConfig.translations
					paths: entityConfig.pathsFor(entity._id.toString())

	add: (entityName, req, res, next)->
		email = req.body.email
		return res.sendStatus 422 unless email

		getEntity entityName, req, (error, entity, entityConfig) ->
			return next(error) if error?
			if entityConfig.readOnly
				return next(new Errors.NotFoundError("Cannot add users to entity"))

			UserMembershipHandler.addUser entity, entityConfig, email, (error, user)->
				return next(error) if error?
				res.json(user: user)

	remove: (entityName, req, res, next)->
		userId = req.params.userId

		getEntity entityName, req, (error, entity, entityConfig) ->
			return next(error) if error?
			if entityConfig.readOnly
				return next(new Errors.NotFoundError("Cannot remove users from entity"))

			UserMembershipHandler.removeUser entity, entityConfig, userId, (error, user)->
				return next(error) if error?
				res.send()

getEntity = (entityName, req, callback) ->
		entityConfig = EntityConfigs[entityName]
		unless entityConfig
			return callback(new Errors.NotFoundError("No such entity: #{entityName}"))

		loggedInUser = AuthenticationController.getSessionUser(req)
		entityId = req.params.id
		UserMembershipHandler.getEntity entityId, entityConfig, loggedInUser, (error, entity)->
			return callback(error) if error?
			return callback(new Errors.NotFoundError()) unless entity?
			callback(null, entity, entityConfig)
