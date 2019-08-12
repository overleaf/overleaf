/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserMembershipAuthorization
const AuthenticationController = require('../Authentication/AuthenticationController')
const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const UserMembershipHandler = require('./UserMembershipHandler')
const EntityConfigs = require('./UserMembershipEntityConfigs')
const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const request = require('request')

module.exports = UserMembershipAuthorization = {
  requireTeamMetricsAccess(req, res, next) {
    return requireAccessToEntity(
      'team',
      req.params.id,
      req,
      res,
      next,
      'groupMetrics'
    )
  },

  requireGroupManagementAccess(req, res, next) {
    return requireAccessToEntity(
      'group',
      req.params.id,
      req,
      res,
      next,
      'groupManagement'
    )
  },

  requireGroupMetricsAccess(req, res, next) {
    return requireAccessToEntity(
      'group',
      req.params.id,
      req,
      res,
      next,
      'groupMetrics'
    )
  },

  requireGroupManagersManagementAccess(req, res, next) {
    return requireAccessToEntity(
      'groupManagers',
      req.params.id,
      req,
      res,
      next,
      'groupManagement'
    )
  },

  requireInstitutionMetricsAccess(req, res, next) {
    return requireAccessToEntity(
      'institution',
      req.params.id,
      req,
      res,
      next,
      'institutionMetrics'
    )
  },

  requireInstitutionManagementAccess(req, res, next) {
    return requireAccessToEntity(
      'institution',
      req.params.id,
      req,
      res,
      next,
      'institutionManagement'
    )
  },

  requireInstitutionManagementStaffAccess(req, res, next) {
    return requireAccessToEntity(
      'institution',
      req.params.id,
      req,
      res,
      next,
      'institutionManagement',
      true
    )
  },

  requirePublisherMetricsAccess(req, res, next) {
    return requireAccessToEntity(
      'publisher',
      req.params.id,
      req,
      res,
      next,
      'publisherMetrics'
    )
  },

  requirePublisherManagementAccess(req, res, next) {
    return requireAccessToEntity(
      'publisher',
      req.params.id,
      req,
      res,
      next,
      'publisherManagement'
    )
  },

  requireAdminMetricsStaffAccess(req, res, next) {
    return requireAccessToEntity(
      'admin',
      'admin',
      req,
      res,
      next,
      'adminMetrics',
      true
    )
  },

  requireTemplateMetricsAccess(req, res, next) {
    const templateId = req.params.id
    return request(
      {
        baseUrl: settings.apis.v1.url,
        url: `/api/v2/templates/${templateId}`,
        method: 'GET',
        auth: {
          user: settings.apis.v1.user,
          pass: settings.apis.v1.pass,
          sendImmediately: true
        }
      },
      (error, response, body) => {
        if (response.statusCode === 404) {
          return next(new Errors.NotFoundError())
        }

        if (response.statusCode !== 200) {
          logger.warn(
            { templateId },
            "[TemplateMetrics] Couldn't fetch template data from v1"
          )
          return next(new Error("Couldn't fetch template data from v1"))
        }

        if (error != null) {
          return next(error)
        }
        try {
          body = JSON.parse(body)
        } catch (error1) {
          error = error1
          return next(error)
        }

        req.template = {
          id: body.id,
          title: body.title
        }
        if (__guard__(body != null ? body.brand : undefined, x => x.slug)) {
          req.params.id = body.brand.slug
          return UserMembershipAuthorization.requirePublisherMetricsAccess(
            req,
            res,
            next
          )
        } else {
          return AuthorizationMiddleware.ensureUserIsSiteAdmin(req, res, next)
        }
      }
    )
  },

  requireGraphAccess(req, res, next) {
    req.params.id = req.query.resource_id
    if (req.query.resource_type === 'template') {
      return UserMembershipAuthorization.requireTemplateMetricsAccess(
        req,
        res,
        next
      )
    } else if (req.query.resource_type === 'institution') {
      return UserMembershipAuthorization.requireInstitutionMetricsAccess(
        req,
        res,
        next
      )
    } else if (req.query.resource_type === 'group') {
      return UserMembershipAuthorization.requireGroupMetricsAccess(
        req,
        res,
        next
      )
    } else if (req.query.resource_type === 'team') {
      return UserMembershipAuthorization.requireTeamMetricsAccess(
        req,
        res,
        next
      )
    } else if (req.query.resource_type === 'admin') {
      return UserMembershipAuthorization.requireAdminMetricsStaffAccess(
        req,
        res,
        next
      )
    }
    return requireAccessToEntity(
      req.query.resource_type,
      req.query.resource_id,
      req,
      res,
      next
    )
  },

  requireEntityCreationAccess(req, res, next) {
    const loggedInUser = AuthenticationController.getSessionUser(req)
    if (!loggedInUser || !hasEntityCreationAccess(loggedInUser)) {
      return AuthorizationMiddleware.redirectToRestricted(req, res, next)
    }
    return next()
  }
}

var requireAccessToEntity = function(
  entityName,
  entityId,
  req,
  res,
  next,
  requiredStaffAccess = null,
  asStaff
) {
  if (asStaff == null) {
    asStaff = false
  }
  const loggedInUser = AuthenticationController.getSessionUser(req)
  if (!loggedInUser) {
    return AuthorizationMiddleware.redirectToRestricted(req, res, next)
  }

  if (asStaff) {
    if (
      !loggedInUser.isAdmin &&
      !(loggedInUser.staffAccess != null
        ? loggedInUser.staffAccess[requiredStaffAccess]
        : undefined)
    ) {
      return AuthorizationMiddleware.redirectToRestricted(req, res, next)
    }
  }

  return getEntity(
    entityName,
    entityId,
    loggedInUser,
    requiredStaffAccess,
    function(error, entity, entityConfig, entityExists) {
      if (error != null) {
        return next(error)
      }

      if (entity != null) {
        req.entity = entity
        req.entityConfig = entityConfig
        return next()
      }

      if (entityExists) {
        // user doesn't have access to entity
        return AuthorizationMiddleware.redirectToRestricted(req, res, next)
      }

      if (hasEntityCreationAccess(loggedInUser) && entityConfig.canCreate) {
        // entity doesn't exists, admin can create it
        return res.redirect(`/entities/${entityName}/create/${entityId}`)
      }

      return next(new Errors.NotFoundError())
    }
  )
}

var getEntity = function(
  entityName,
  entityId,
  user,
  requiredStaffAccess,
  callback
) {
  if (callback == null) {
    callback = function(error, entity, entityConfig, entityExists) {}
  }
  const entityConfig = EntityConfigs[entityName]
  if (!entityConfig) {
    return callback(new Errors.NotFoundError(`No such entity: ${entityName}`))
  }
  if (!entityConfig.modelName) {
    return callback(null, { id: entityName }, entityConfig, true)
  }

  return UserMembershipHandler.getEntity(
    entityId,
    entityConfig,
    user,
    requiredStaffAccess,
    function(error, entity) {
      if (error != null) {
        return callback(error)
      }
      if (entity != null) {
        return callback(null, entity, entityConfig, true)
      }

      // no access to entity. Check if entity exists
      return UserMembershipHandler.getEntityWithoutAuthorizationCheck(
        entityId,
        entityConfig,
        function(error, entity) {
          if (error != null) {
            return callback(error)
          }
          return callback(null, null, entityConfig, entity != null)
        }
      )
    }
  )
}

var hasEntityCreationAccess = user =>
  user.isAdmin ||
  (user.staffAccess != null
    ? user.staffAccess['institutionManagement']
    : undefined) ||
  (user.staffAccess != null
    ? user.staffAccess['publisherManagement']
    : undefined)

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
