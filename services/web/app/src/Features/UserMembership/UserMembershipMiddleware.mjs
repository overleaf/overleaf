// @ts-check

import { expressify } from '@overleaf/promise-utils'

import UserMembershipAuthorization from './UserMembershipAuthorization.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import UserMembershipHandler from './UserMembershipHandler.mjs'
import EntityConfigs from './UserMembershipEntityConfigs.mjs'
import Errors from '../Errors/Errors.js'
import HttpErrorHandler from '../Errors/HttpErrorHandler.mjs'
import TemplatesManager from '../Templates/TemplatesManager.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
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
      UserMembershipAuthorization.hasAdminAccess,
    ]),
  ],

  requireGroup: [fetchEntityConfig('group'), fetchEntity(), requireEntity()],

  requireGroupAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('group'),
    fetchEntity(),
    requireEntity(),
  ],

  requireEntityAccess: (
    /** @type {{ entityName: any; adminCapability?: any }} */ {
      entityName,
      adminCapability,
    }
  ) => [
    AuthenticationController.requireLogin(),
    fetchEntityConfig(entityName),
    fetchEntity(),
    requireEntity(),
    allowAccessIfAny(
      [
        UserMembershipAuthorization.hasEntityAccess(),
        adminCapability &&
          UserMembershipAuthorization.hasAdminCapability(adminCapability),
      ].filter(Boolean)
    ),
  ],

  requireEntityAccessOrAdminAccess: (/** @type {any} */ entityName) => [
    AuthenticationController.requireLogin(),
    fetchEntityConfig(entityName),
    fetchEntity(),
    requireEntity(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminCapability('modify-group'),
    ]),
  ],

  requireGroupMemberManagement: (/** @type {any} */ entityName) => [
    AuthenticationController.requireLogin(),
    fetchEntityConfig(entityName),
    fetchEntity(),
    requireEntity(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
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
      UserMembershipAuthorization.hasAdminAccess,
    ]),
  ],

  requireInstitutionMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminAccess,
    ]),
  ],

  requireInstitutionManagerAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminAccess,
    ]),
  ],

  requireInstitutionManagerManagement: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminCapability(
        'modify-institution-manager'
      ),
    ]),
  ],

  requireInstitutionAIAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate(),
    allowAccessIfAny([UserMembershipAuthorization.hasAdminAccess]),
  ],

  requireInstitutionStaffHubAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('institution'),
    fetchEntity(),
    requireEntityOrCreate(),
    allowAccessIfAny([UserMembershipAuthorization.hasAdminAccess]),
  ],

  requirePublisherMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminAccess,
    ]),
  ],

  requirePublisherManagementAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminCapability(
        'modify-publisher-manager'
      ),
    ]),
  ],

  requireConversionMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchEntityConfig('publisher'),
    fetchEntity(),
    requireEntityOrCreate(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminAccess,
    ]),
  ],

  requireAdminMetricsAccess: [
    AuthenticationController.requireLogin(),
    allowAccessIfAny([UserMembershipAuthorization.hasAdminAccess]),
  ],

  requireTemplateMetricsAccess: [
    AuthenticationController.requireLogin(),
    fetchV1Template(),
    requireV1Template(),
    fetchEntityConfig('publisher'),
    fetchPublisherFromTemplate(),
    allowAccessIfAny([
      UserMembershipAuthorization.hasEntityAccess(),
      UserMembershipAuthorization.hasAdminAccess,
    ]),
  ],

  requirePublisherCreationAccess: [
    AuthenticationController.requireLogin(),
    allowAccessIfAny([UserMembershipAuthorization.hasAdminAccess]),
    fetchEntityConfig('publisher'),
  ],

  requireInstitutionCreationAccess: [
    AuthenticationController.requireLogin(),
    allowAccessIfAny([UserMembershipAuthorization.hasAdminAccess]),
    fetchEntityConfig('institution'),
  ],

  requireSplitTestMetricsAccess: [
    AuthenticationController.requireLogin(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasAdminCapability('view-split-test'),
    ]),
  ],

  requireSplitTestManagementAccess: [
    AuthenticationController.requireLogin(),
    useAdminCapabilities,
    allowAccessIfAny([
      UserMembershipAuthorization.hasAdminCapability('modify-split-test'),
    ]),
  ],

  requireGraphAccess,
}

export default UserMembershipMiddleware

/**
 * fetch entity config and set it in the request
 *
 * @param {any} entityName
 */
function fetchEntityConfig(entityName) {
  return (
    /** @type {any} */ req,
    /** @type {any} */ res,
    /** @type {any} */ next
  ) => {
    const entityConfig = /** @type {Record<string, any>} */ (EntityConfigs)[
      entityName
    ]
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
    'groupUsers',
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

// graphs access is an edge-case:
// - the entity id is in `req.query.resource_id`. It must be set as
// `req.params.id`
// - the entity name is in `req.query.resource_type` and is used to find the
// require middleware depending on the entity name
/**
 * @param {any} req
 * @param {any} res
 * @param {any} next
 */
function requireGraphAccess(req, res, next) {
  const entityName = req.query.resource_type
  if (!entityName) {
    return HttpErrorHandler.notFound(req, res, 'resource_type param missing')
  }
  const middleWareName =
    entityName.charAt(0).toUpperCase() + entityName.slice(1)

  const middlewares = /** @type {Record<string, any>} */ (
    UserMembershipMiddleware
  )[`require${middleWareName}MetricsAccess`]
  if (!middlewares) {
    return HttpErrorHandler.notFound(
      req,
      res,
      `incorrect entity name: ${middleWareName}`
    )
  }

  // call next router with fixed params to pass it to the correct middleware chain
  const { graph } = req.params
  const entityRoute = entityName === 'splitTest' ? 'split-test' : entityName

  // all other routes go through analytics, which map undefined graph type to index (to fetch all graphs)
  // conversion still goes directly to v1, which can not handle an undefined graph param
  if (!graph?.length && entityRoute === 'conversion') {
    req.url = `/graphs/conversion/index/${req.query.resource_id}`
  } else {
    req.url = `/graphs/${entityRoute}/${graph}/${req.query.resource_id}`
  }
  next('route')
}

// fetch the entity with id and config, and set it in the request
function fetchEntity() {
  return expressify(
    async (
      /** @type {any} */ req,
      /** @type {any} */ res,
      /** @type {any} */ next
    ) => {
      const { params } = parseReq(req, fetchEntitySchema)
      req.entity =
        await UserMembershipHandler.promises.getEntityWithoutAuthorizationCheck(
          params.id,
          req.entityConfig
        )
      next()
    }
  )
}

function fetchPublisherFromTemplate() {
  return (
    /** @type {any} */ req,
    /** @type {any} */ res,
    /** @type {any} */ next
  ) => {
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
  return (
    /** @type {any} */ req,
    /** @type {any} */ res,
    /** @type {any} */ next
  ) => {
    if (req.entity) {
      return next()
    }

    throw new Errors.NotFoundError(
      `no '${req.entityName}' entity with '${req.params.id}'`
    )
  }
}

/**
 * ensure an entity was found or redirect to entity creation page if the user
 * has permissions to create the entity, or fail with 404
 */
function requireEntityOrCreate() {
  return (
    /** @type {any} */ req,
    /** @type {any} */ res,
    /** @type {any} */ next
  ) => {
    if (req.entity) {
      return next()
    }

    if (UserMembershipAuthorization.hasAdminAccess(req)) {
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
  return expressify(
    async (
      /** @type {any} */ req,
      /** @type {any} */ res,
      /** @type {any} */ next
    ) => {
      const templateId = req.params.id
      const body = await TemplatesManager.promises.fetchFromV1(templateId)
      req.template = {
        id: body.id,
        title: body.title,
        brand: body.brand,
      }
      next()
    }
  )
}

// ensure a template was found, or fail with 404
function requireV1Template() {
  return (
    /** @type {any} */ req,
    /** @type {any} */ res,
    /** @type {any} */ next
  ) => {
    if (req.template.id) {
      return next()
    }

    throw new Errors.NotFoundError('no template found')
  }
}

/**
 * run a series of synchronous access functions and call `next` if any of the
 * return values is truly. Redirect to restricted otherwise
 *
 * @param {any} accessFunctions
 */
function allowAccessIfAny(accessFunctions) {
  return (
    /** @type {any} */ req,
    /** @type {any} */ res,
    /** @type {any} */ next
  ) => {
    for (const accessFunction of accessFunctions) {
      if (accessFunction(req)) {
        return next()
      }
    }
    HttpErrorHandler.forbidden(req, res)
  }
}
