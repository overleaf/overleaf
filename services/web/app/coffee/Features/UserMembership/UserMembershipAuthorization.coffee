AuthenticationController = require('../Authentication/AuthenticationController')
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
UserMembershipHandler = require('./UserMembershipHandler')
EntityConfigs = require('./UserMembershipEntityConfigs')
Errors = require('../Errors/Errors')
logger = require("logger-sharelatex")

module.exports =
	requireTeamAccess: (req, res, next) ->
		requireAccessToEntity('team', req.params.id, req, res, next)

	requireGroupAccess: (req, res, next) ->
		requireAccessToEntity('group', req.params.id, req, res, next)

	requireGroupManagersAccess: (req, res, next) ->
		requireAccessToEntity('groupManagers', req.params.id, req, res, next)

	requireInstitutionAccess: (req, res, next) ->
		requireAccessToEntity('institution', req.params.id, req, res, next)

	requireGraphAccess: (req, res, next) ->
		requireAccessToEntity(
			req.query.resource_type, req.query.resource_id, req, res, next
		)

requireAccessToEntity = (entityName, entityId, req, res, next) ->
	loggedInUser = AuthenticationController.getSessionUser(req)
	unless loggedInUser
		return AuthorizationMiddlewear.redirectToRestricted req, res, next

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
