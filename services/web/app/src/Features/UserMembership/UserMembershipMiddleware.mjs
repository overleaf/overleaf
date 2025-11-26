// @ts-check

import { expressify } from '@overleaf/promise-utils'

import async from 'async'
import UserMembershipAuthorization from './UserMembershipAuthorization.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import UserMembershipHandler from './UserMembershipHandler.mjs'
import EntityConfigs from './UserMembershipEntityConfigs.mjs'
import Errors from '../Errors/Errors.js'
import HttpErrorHandler from '../Errors/HttpErrorHandler.mjs'
import TemplatesManager from '../Templates/TemplatesManager.mjs'
import { z, zz, validateReq } from '../../infrastructure/Validation.js'
import AdminAuthorizationHelper from '../Helpers/AdminAuthorizationHelper.mjs'

const { useAdminCapabilities } = AdminAuthorizationHelper
// set of middleware arrays or functions that checks user access to an entity
// (publisher, institution, group, template, etc.)
const UserMembershipMiddleware = {
  requireTeamMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('team'),
    fetchEntity(),
    requireEntity(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupMetrics'),
    ]),
  ],

  requireGroup: [fetchEntityConfig('group'), fetchEntity(), requireEntity()],

  requireGroupAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('group'),
    fetchEntity(),
    requireEntity(),
  ],

  requireEntityAccess: ({ entityName, staffAccess, adminCapability }) => [
    AuthenticationController.requireLogin(),
    fetchEntityConfig(entityName),
    fetchEntity(),
    requireEntity(),
    allowAccessIfAny(
      [
        UserMembershipAuthorization.hasEntityAccess(),
        staffAccess && UserMembershipAuthorization.hasStaffAccess(staffAccess),
        adminCapability &&
          UserMembershipAuthorization.hasAdminCapability(adminCapability),
      ].filter(Boolean)
    ),
  ],

  requireEntityAccessOrAdminAccess: entityName => [
    AuthenticationController.requireLogin(),
    fetchEntityConfig(entityName),
    fetchEntity(),
    requireEntity(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupManagement'),
      // allow to all admins when `adminRolesEnabled` is true
      UserMembershipAuthorization.hasAnyAdminRole,
    ]),
  ],

  requireGroupMemberManagement: entityName => [
    AuthenticationController.requireLogin(),
    fetchEntityConfig(entityName),
    fetchEntity(),
    requireEntity(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupManagement'),
      UserMembershipAuthorization.hasModifyGroupMemberCapability,
    ]),
  ],

  requireGroupMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('group'),
    fetchEntity(),
    requireEntity(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('groupMetrics'),
    ]),
  ],

  requireInstitutionMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate('institutionManagement'),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('institutionMetrics'),
    ]),
  ],

  requireInstitutionManagementAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate('institutionManagement'),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('institutionManagement'),
    ]),
  ],

  requireInstitutionManagementStaffAccess: [
    AuthenticationController.requireLogin(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasStaffAccess('institutionManagement'),
    ]),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate('institutionManagement'),
  ],

  requirePublisherMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate('publisherManagement'),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherMetrics'),
    ]),
  ],

  requirePublisherManagementAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate('publisherManagement'),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherManagement'),
    ]),
  ],

  requireConversionMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate('publisherManagement'),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherMetrics'),
    ]),
  ],

  requireAdminMetricsAccess: [
    AuthenticationController.requireLogin(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasStaffAccess('adminMetrics'),
    ]),
  ],

  requireTemplateMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchV1Template(),
    requireV1Template(),
    fetchEntityConfig('publisher'),
    fetchPublisherFromTemplate(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasStaffAccess('publisherMetrics'),
    ]),
  ],

  requirePublisherCreationAccess: [
    AuthenticationController.requireLogin(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasStaffAccess('publisherManagement'),
    ]),
    fetchEntityConfig('publisher'),
  ],

  requireInstitutionCreationAccess: [
    AuthenticationController.requireLogin(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasStaffAccess('institutionManagement'),
    ]),
    fetchEntityConfig('institution'),
  ],

  requireSplitTestMetricsAccess: [
    AuthenticationController.requireLogin(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasStaffAccess('splitTestMetrics'),
      UserMembershipAuthorization.hasStaffAccess('splitTestManagement'),
      UserMembershipAuthorization.hasAdminCapability('view-split-test'),
    ]),
  ],

  requireSplitTestManagementAccess: [
    AuthenticationController.requireLogin(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasStaffAccess('splitTestManagement'),
      UserMembershipAuthorization.hasAdminCapability('modify-split-test'),
    ]),
  ],

  // graphs access is an edge-case:
  // - the entity id is in `req.query.resource_id`. It must be set as
  // `req.params.id`
  // - the entity name is in `req.query.resource_type` and is used to find the
  // require middleware depending on the entity name
  requireGraphAccess(req, res, next) {
    req.params.id = req.query.resource_id
    let entityName = req.query.resource_type
    if (!entityName) {
      return HttpErrorHandler.notFound(req, res, 'resource_type param missing')
    }
    entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1)

    const middleware =
      UserMembershipMiddleware[`require${entityName}MetricsAccess`]
    if (!middleware) {
      return HttpErrorHandler.notFound(
        req,
        res,
        `incorrect entity name: ${entityName}`
      )
    }
    // run the list of middleware functions in series. This is essencially
    // a poor man's middleware runner
    async.eachSeries(middleware, (fn, callback) => fn(req, res, callback), next)
  },
}

export default UserMembershipMiddleware

// fetch entity config and set it in the request
function fetchEntityConfig(entityName) {
  return (req, res, next) => {
    const entityConfig = EntityConfigs[entityName]
    req.entityName = entityName
    req.entityConfig = entityConfig
    next()
  }
}

const SlugEntitySchema = z.object({
  entityName: z.literal('publisher'),
  params: z.object({
    id: z.string(), // slug
  }),
})

const PostgresIdEntitySchema = z.object({
  entityName: z.literal(['institution', 'team']),
  params: z.object({
    id: z.coerce.number().positive(),
  }),
})

const ObjectIdEntitySchema = z.object({
  entityName: z.literal([
    'group',
    'groupAdmin',
    'groupManagers',
    'groupMember',
  ]),
  params: z.object({
    id: zz.coercedObjectId(),
  }),
})

const fetchEntitySchema = z.discriminatedUnion('entityName', [
  SlugEntitySchema,
  ObjectIdEntitySchema,
  PostgresIdEntitySchema,
])

// fetch the entity with id and config, and set it in the request
function fetchEntity() {
  return expressify(async (req, res, next) => {
    const { params } = validateReq(req, fetchEntitySchema)
    req.entity =
      await UserMembershipHandler.promises.getEntityWithoutAuthorizationCheck(
        params.id,
        req.entityConfig
      )
    next()
  })
}

function fetchPublisherFromTemplate() {
  return (req, res, next) => {
    if (req.template.brand.slug) {
      // set the id as the publisher's id as it's the entity used for access
      // control
      req.params.id = req.template.brand.slug
      return fetchEntity()(req, res, next)
    } else {
      return next()
    }
  }
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
      brand: body.brand,
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
function allowAccessIfAny(accessFunctions) {
  return (req, res, next) => {
    for (const accessFunction of accessFunctions) {
      if (accessFunction(req)) {
        return next()
      }
    }
    HttpErrorHandler.forbidden(req, res)
  }
}
