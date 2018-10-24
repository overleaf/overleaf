AuthenticationController = require('../Authentication/AuthenticationController')
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
UserMembershipHandler = require('./UserMembershipHandler')
EntityConfigs = require('./UserMembershipEntityConfigs')
Errors = require('../Errors/Errors')
logger = require("logger-sharelatex")

module.exports =
	requireEntityAccess: (entityName) ->
		(req, res, next) ->
			loggedInUser = AuthenticationController.getSessionUser(req)
			unless loggedInUser
				return AuthorizationMiddlewear.redirectToRestricted req, res, next

			entityId = req.params.id
			getEntity entityName, entityId, loggedInUser, (error, entity, entityConfig) ->
				return next(error) if error?
				unless entity?
					return AuthorizationMiddlewear.redirectToRestricted(req, res, next)

				req.entity = entity
				req.entityConfig = entityConfig
				next()

getEntity = (entityName, entityId, userId, callback = (error, entity, entityConfig)->) ->
	entityConfig = EntityConfigs[entityName]
	unless entityConfig
		return callback(new Errors.NotFoundError("No such entity: #{entityName}"))

	UserMembershipHandler.getEntity entityId, entityConfig, userId, (error, entity)->
		return callback(error) if error?
		callback(null, entity, entityConfig)
