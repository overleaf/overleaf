let AuthorizationMiddleware
const AuthorizationManager = require('./AuthorizationManager')
const async = require('async')
const logger = require('logger-sharelatex')
const { ObjectId } = require('mongojs')
const Errors = require('../Errors/Errors')
const HttpErrors = require('@overleaf/o-error/http')
const AuthenticationController = require('../Authentication/AuthenticationController')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')

module.exports = AuthorizationMiddleware = {
  ensureUserCanReadMultipleProjects(req, res, next) {
    const projectIds = (req.query.project_ids || '').split(',')
    AuthorizationMiddleware._getUserId(req, function(error, userId) {
      if (error) {
        return next(error)
      }
      // Remove the projects we have access to. Note rejectSeries doesn't use
      // errors in callbacks
      async.rejectSeries(
        projectIds,
        function(projectId, cb) {
          const token = TokenAccessHandler.getRequestToken(req, projectId)
          AuthorizationManager.canUserReadProject(
            userId,
            projectId,
            token,
            function(error, canRead) {
              if (error) {
                return next(error)
              }
              cb(canRead)
            }
          )
        },
        function(unauthorizedProjectIds) {
          if (unauthorizedProjectIds.length > 0) {
            return AuthorizationMiddleware.redirectToRestricted(req, res, next)
          }
          next()
        }
      )
    })
  },

  ensureUserCanReadProject(req, res, next) {
    AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      userId,
      projectId
    ) {
      if (error) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, projectId)
      AuthorizationManager.canUserReadProject(
        userId,
        projectId,
        token,
        function(error, canRead) {
          if (error) {
            return next(error)
          }
          if (canRead) {
            logger.log(
              { userId, projectId },
              'allowing user read access to project'
            )
            return next()
          }
          logger.log(
            { userId, projectId },
            'denying user read access to project'
          )
          const acceptHeader = req.headers && req.headers['accept']
          if (acceptHeader && acceptHeader.match(/^application\/json.*$/)) {
            return res.sendStatus(403)
          }
          AuthorizationMiddleware.redirectToRestricted(req, res, next)
        }
      )
    })
  },

  ensureUserCanWriteProjectSettings(req, res, next) {
    AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      userId,
      projectId
    ) {
      if (error) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, projectId)
      AuthorizationManager.canUserWriteProjectSettings(
        userId,
        projectId,
        token,
        function(error, canWrite) {
          if (error) {
            return next(error)
          }
          if (canWrite) {
            logger.log(
              { userId, projectId },
              'allowing user write access to project settings'
            )
            return next()
          }
          logger.log(
            { userId, projectId },
            'denying user write access to project settings'
          )
          AuthorizationMiddleware.redirectToRestricted(req, res, next)
        }
      )
    })
  },

  ensureUserCanWriteProjectContent(req, res, next) {
    AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      userId,
      projectId
    ) {
      if (error) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, projectId)
      AuthorizationManager.canUserWriteProjectContent(
        userId,
        projectId,
        token,
        function(error, canWrite) {
          if (error) {
            return next(error)
          }
          if (canWrite) {
            logger.log(
              { userId, projectId },
              'allowing user write access to project content'
            )
            return next()
          }
          logger.log(
            { userId, projectId },
            'denying user write access to project settings'
          )
          AuthorizationMiddleware.redirectToRestricted(req, res, next)
        }
      )
    })
  },

  ensureUserCanAdminProject(req, res, next) {
    AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      userId,
      projectId
    ) {
      if (error) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, projectId)
      AuthorizationManager.canUserAdminProject(
        userId,
        projectId,
        token,
        function(error, canAdmin) {
          if (error) {
            return next(error)
          }
          if (canAdmin) {
            logger.log(
              { userId, projectId },
              'allowing user admin access to project'
            )
            return next()
          }
          logger.log(
            { userId, projectId },
            'denying user admin access to project'
          )
          next(new HttpErrors.ForbiddenError({}))
        }
      )
    })
  },

  ensureUserIsSiteAdmin(req, res, next) {
    AuthorizationMiddleware._getUserId(req, function(error, userId) {
      if (error) {
        return next(error)
      }
      AuthorizationManager.isUserSiteAdmin(userId, function(error, isAdmin) {
        if (error) {
          return next(error)
        }
        if (isAdmin) {
          logger.log({ userId }, 'allowing user admin access to site')
          return next()
        }
        logger.log({ userId }, 'denying user admin access to site')
        AuthorizationMiddleware.redirectToRestricted(req, res, next)
      })
    })
  },

  _getUserAndProjectId(req, callback) {
    const projectId = req.params.project_id || req.params.Project_id
    if (!projectId) {
      return callback(new Error('Expected project_id in request parameters'))
    }
    if (!ObjectId.isValid(projectId)) {
      return callback(
        new Errors.NotFoundError(`invalid projectId: ${projectId}`)
      )
    }
    AuthorizationMiddleware._getUserId(req, function(error, userId) {
      if (error) {
        return callback(error)
      }
      callback(null, userId, projectId)
    })
  },

  _getUserId(req, callback) {
    const userId =
      AuthenticationController.getLoggedInUserId(req) ||
      (req.oauth_user && req.oauth_user._id) ||
      null
    callback(null, userId)
  },

  redirectToRestricted(req, res, next) {
    // TODO: move this to throwing ForbiddenError
    res.redirect(`/restricted?from=${encodeURIComponent(req.url)}`)
  },

  restricted(req, res, next) {
    if (AuthenticationController.isUserLoggedIn(req)) {
      return res.render('user/restricted', { title: 'restricted' })
    }
    const { from } = req.query
    logger.log({ from }, 'redirecting to login')
    if (from) {
      AuthenticationController.setRedirectInSession(req, from)
    }
    res.redirect('/login')
  }
}
