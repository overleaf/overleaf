AuthenticationController = require('../Authentication/AuthenticationController')
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
UserMembershipHandler = require('./UserMembershipHandler')
EntityConfigs = require('./UserMembershipEntityConfigs')
Errors = require('../Errors/Errors')
logger = require("logger-sharelatex")
settings = require 'settings-sharelatex'
request = require 'request'

module.exports = UserMembershipAuthorization =
	requireTeamMetricsAccess: (req, res, next) ->
		requireAccessToEntity('team', req.params.id, req, res, next, 'groupMetrics')

	requireGroupManagementAccess: (req, res, next) ->
		requireAccessToEntity('group', req.params.id, req, res, next, 'groupManagement')

	requireGroupMetricsAccess:	(req, res, next) ->
		requireAccessToEntity('group', req.params.id, req, res, next, 'groupMetrics')

	requireGroupManagersManagementAccess: (req, res, next) ->
		requireAccessToEntity('groupManagers', req.params.id, req, res, next, 'groupManagement')

	requireInstitutionMetricsAccess:	(req, res, next) ->
		requireAccessToEntity('institution', req.params.id, req, res, next, 'institutionMetrics')

	requireInstitutionManagementAccess:	(req, res, next) ->
		requireAccessToEntity('institution', req.params.id, req, res, next, 'institutionManagement')

	requirePublisherMetricsAccess:	(req, res, next) ->
		requireAccessToEntity('publisher', req.params.id, req, res, next, 'publisherMetrics')

	requirePublisherManagementAccess:	(req, res, next) ->
		requireAccessToEntity('publisher', req.params.id, req, res, next, 'publisherManagement')

	requireTemplateMetricsAccess: (req, res, next) ->
		templateId = req.params.id
		request {
			baseUrl: settings.apis.v1.url
			url: "/api/v2/templates/#{templateId}"
			method: 'GET'
			auth:
				user: settings.apis.v1.user
				pass: settings.apis.v1.pass
				sendImmediately: true
		}, (error, response, body) =>
			if response.statusCode == 404
				return next(new Errors.NotFoundError())

			if response.statusCode != 200
				logger.err { templateId }, "[TemplateMetrics] Couldn't fetch template data from v1"
				return next(new Error("Couldn't fetch template data from v1"))

			return next(error) if error?
			try
				body = JSON.parse(body)
			catch error
				return next(error)

			req.template =
				id: body.id
				title: body.title
			if body?.brand?.slug
				req.params.id = body.brand.slug
				UserMembershipAuthorization.requirePublisherMetricsAccess(req, res, next)
			else
				AuthorizationMiddlewear.ensureUserIsSiteAdmin(req, res, next)

	requireGraphAccess: (req, res, next) ->
		req.params.id = req.query.resource_id
		if req.query.resource_type == 'template'
			return UserMembershipAuthorization.requireTemplateMetricsAccess(req, res, next)
		else if req.query.resource_type == 'institution'
			return UserMembershipAuthorization.requireInstitutionMetricsAccess(req, res, next)
		else if req.query.resource_type == 'group'
			return UserMembershipAuthorization.requireGroupMetricsAccess(req, res, next)
		else if req.query.resource_type == 'team'
			return UserMembershipAuthorization.requireTeamMetricsAccess(req, res, next)
		requireAccessToEntity(req.query.resource_type, req.query.resource_id, req, res, next)

requireAccessToEntity = (entityName, entityId, req, res, next, requiredStaffAccess=null) ->
	loggedInUser = AuthenticationController.getSessionUser(req)
	unless loggedInUser
		return AuthorizationMiddlewear.redirectToRestricted req, res, next

	getEntity entityName, entityId, loggedInUser, requiredStaffAccess, (error, entity, entityConfig, entityExists) ->
		return next(error) if error?

		if entity?
			req.entity = entity
			req.entityConfig = entityConfig
			return next()

		if entityExists # user doesn't have access to entity
			return AuthorizationMiddlewear.redirectToRestricted(req, res, next)

		if loggedInUser.isAdmin and entityConfig.canCreate
			# entity doesn't exists, admin can create it
			return res.redirect "/entities/#{entityName}/create/#{entityId}"

		next(new Errors.NotFoundError())

getEntity = (entityName, entityId, user, requiredStaffAccess, callback = (error, entity, entityConfig, entityExists)->) ->
	entityConfig = EntityConfigs[entityName]
	unless entityConfig
		return callback(new Errors.NotFoundError("No such entity: #{entityName}"))

	UserMembershipHandler.getEntity entityId, entityConfig, user, requiredStaffAccess, (error, entity)->
		return callback(error) if error?
		return callback(null, entity, entityConfig, true) if entity?

		# no access to entity. Check if entity exists
		UserMembershipHandler.getEntityWithoutAuthorizationCheck entityId, entityConfig, (error, entity)->
			return callback(error) if error?
			callback(null, null, entityConfig, entity?)
