const expressify = require('../../util/expressify')
const async = require('async')
const UserMembershipAuthorization = require('./UserMembershipAuthorization')
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserMembershipHandler = require('./UserMembershipHandler')
const EntityConfigs = require('./UserMembershipEntityConfigs')
const Errors = require('../Errors/Errors')
const HttpErrors = require('@overleaf/o-error/http')
const TemplatesManager = require('../Templates/TemplatesManager')

// set of middleware arrays or functions that checks user access to an entity
// (publisher, institution, group, template, etc.)
let UserMembershipMiddleware = {
  requireTeamMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('team'),
    fetchEntity(),
    requireEntity(),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupMetrics')
    ])
  ],

  requireGroupManagementAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('group'),
    fetchEntity(),
    requireEntity(),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupManagement')
    ])
  ],

  requireGroupMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('group'),
    fetchEntity(),
    requireEntity(),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupMetrics')
    ])
  ],

  requireGroupManagersManagementAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('groupManagers'),
    fetchEntity(),
    requireEntity(),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupManagement')
    ])
  ],

  requireInstitutionMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate('institutionManagement'),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('institutionMetrics')
    ])
  ],

  requireInstitutionManagementAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate('institutionManagement'),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('institutionManagement')
    ])
  ],

  requireInstitutionManagementStaffAccess: [
    AuthenticationController.requireLogin(),
    restrictAccess([
      UserMembershipAuthorization.hasStaffAccess('institutionManagement')
    ]),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate('institutionManagement')
  ],

  requirePublisherMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate('publisherManagement'),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherMetrics')
    ])
  ],

  requirePublisherManagementAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate('publisherManagement'),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherManagement')
    ])
  ],

  requireConversionMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate('publisherManagement'),
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherMetrics')
    ])
  ],

  requireAdminMetricsAccess: [
    AuthenticationController.requireLogin(),
    restrictAccess([UserMembershipAuthorization.hasStaffAccess('adminMetrics')])
  ],

  requireTemplateMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchV1Template(),
    requireV1Template(),
    fetchEntityConfig('publisher'),
    fetchEntity(), // at this point the entity is the template's publisher, if any
    restrictAccess([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherMetrics')
    ])
  ],

  requirePublisherCreationAccess: [
    AuthenticationController.requireLogin(),
    restrictAccess([
      UserMembershipAuthorization.hasStaffAccess('publisherManagement')
    ]),
    fetchEntityConfig('publisher')
  ],

  requireInstitutionCreationAccess: [
    AuthenticationController.requireLogin(),
    restrictAccess([
      UserMembershipAuthorization.hasStaffAccess('institutionManagement')
    ]),
    fetchEntityConfig('institution')
  ],

  // graphs access is an edge-case:
  // - the entity id is in `req.query.resource_id`. It must be set as
  // `req.params.id`
  // - the entity name is in `req.query.resource_type` and is used to find the
  // require middleware depending on the entity name
  requireGraphAccess(req, res, next) {
    req.params.id = req.query.resource_id
    let entityName = req.query.resource_type
    entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1)

    // run the list of middleware functions in series. This is essencially
    // a poor man's middleware runner
    async.eachSeries(
      UserMembershipMiddleware[`require${entityName}MetricsAccess`],
      (fn, callback) => fn(req, res, callback),
      next
    )
  }
}

module.exports = UserMembershipMiddleware

// fetch entity config and set it in the request
function fetchEntityConfig(entityName) {
  return (req, res, next) => {
    const entityConfig = EntityConfigs[entityName]
    req.entityName = entityName
    req.entityConfig = entityConfig
    next()
  }
}

// fetch the entity with id and config, and set it in the request
function fetchEntity() {
  return expressify(async (req, res, next) => {
    let entity = await UserMembershipHandler.promises.getEntityWithoutAuthorizationCheck(
      req.params.id,
      req.entityConfig
    )
    req.entity = entity
    next()
  })
}

// ensure an entity was found, or fail with 404
function requireEntity() {
  return (req, res, next) => {
    if (req.entity) {
      return next()
    }

    throw new Errors.NotFoundError(
      `no '${req.entityName}' entity with '${req.params.id}'`
    )
  }
}

// ensure an entity was found or redirect to entity creation page if the user
// has permissions to create the entity, or fail with 404
function requireEntityOrCreate(creationStaffAccess) {
  return (req, res, next) => {
    if (req.entity) {
      return next()
    }

    if (UserMembershipAuthorization.hasStaffAccess(creationStaffAccess)(req)) {
      res.redirect(`/entities/${req.entityName}/create/${req.params.id}`)
      return
    }

    throw new Errors.NotFoundError(
      `no '${req.entityName}' entity with '${req.params.id}'`
    )
  }
}

// fetch the template from v1, and set it in the request
function fetchV1Template() {
  return expressify(async (req, res, next) => {
    const templateId = req.params.id
    const body = await TemplatesManager.promises.fetchFromV1(templateId)
    req.template = {
      id: body.id,
      title: body.title,
      brand: body.brand
    }
    if (req.template.brand.slug) {
      // set the id as the publisher's id as it's the entity used for access
      // control
      req.params.id = req.template.brand.slug
    }
    next()
  })
}

// ensure a template was found, or fail with 404
function requireV1Template() {
  return (req, res, next) => {
    if (req.template.id) {
      return next()
    }

    throw new Errors.NotFoundError('no template found')
  }
}

// run a serie of synchronous access functions and call `next` if any of the
// retur values is truly. Redirect to restricted otherwise
function restrictAccess(accessFunctions) {
  return (req, res, next) => {
    for (let accessFunction of accessFunctions) {
      if (accessFunction(req)) {
        return next()
      }
    }
    next(new HttpErrors.ForbiddenError({}))
  }
}
