/* eslint-disable
    camelcase,
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
let AuthorizationMiddleware
const AuthorizationManager = require('./AuthorizationManager')
const async = require('async')
const logger = require('logger-sharelatex')
const { ObjectId } = require('mongojs')
const Errors = require('../Errors/Errors')
const AuthenticationController = require('../Authentication/AuthenticationController')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')

module.exports = AuthorizationMiddleware = {
  ensureUserCanReadMultipleProjects(req, res, next) {
    const project_ids = (req.query.project_ids || '').split(',')
    return AuthorizationMiddleware._getUserId(req, function(error, user_id) {
      if (error != null) {
        return next(error)
      }
      // Remove the projects we have access to. Note rejectSeries doesn't use
      // errors in callbacks
      return async.rejectSeries(
        project_ids,
        function(project_id, cb) {
          const token = TokenAccessHandler.getRequestToken(req, project_id)
          return AuthorizationManager.canUserReadProject(
            user_id,
            project_id,
            token,
            function(error, canRead) {
              if (error != null) {
                return next(error)
              }
              return cb(canRead)
            }
          )
        },
        function(unauthorized_project_ids) {
          if (unauthorized_project_ids.length > 0) {
            return AuthorizationMiddleware.redirectToRestricted(req, res, next)
          } else {
            return next()
          }
        }
      )
    })
  },

  ensureUserCanReadProject(req, res, next) {
    return AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      user_id,
      project_id
    ) {
      if (error != null) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, project_id)
      return AuthorizationManager.canUserReadProject(
        user_id,
        project_id,
        token,
        function(error, canRead) {
          if (error != null) {
            return next(error)
          }
          if (canRead) {
            logger.log(
              { user_id, project_id },
              'allowing user read access to project'
            )
            return next()
          } else {
            logger.log(
              { user_id, project_id },
              'denying user read access to project'
            )
            if (
              __guard__(
                req.headers != null ? req.headers['accept'] : undefined,
                x => x.match(/^application\/json.*$/)
              )
            ) {
              return res.sendStatus(403)
            } else {
              return AuthorizationMiddleware.redirectToRestricted(
                req,
                res,
                next
              )
            }
          }
        }
      )
    })
  },

  ensureUserCanWriteProjectSettings(req, res, next) {
    return AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      user_id,
      project_id
    ) {
      if (error != null) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, project_id)
      return AuthorizationManager.canUserWriteProjectSettings(
        user_id,
        project_id,
        token,
        function(error, canWrite) {
          if (error != null) {
            return next(error)
          }
          if (canWrite) {
            logger.log(
              { user_id, project_id },
              'allowing user write access to project settings'
            )
            return next()
          } else {
            logger.log(
              { user_id, project_id },
              'denying user write access to project settings'
            )
            return AuthorizationMiddleware.redirectToRestricted(req, res, next)
          }
        }
      )
    })
  },

  ensureUserCanWriteProjectContent(req, res, next) {
    return AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      user_id,
      project_id
    ) {
      if (error != null) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, project_id)
      return AuthorizationManager.canUserWriteProjectContent(
        user_id,
        project_id,
        token,
        function(error, canWrite) {
          if (error != null) {
            return next(error)
          }
          if (canWrite) {
            logger.log(
              { user_id, project_id },
              'allowing user write access to project content'
            )
            return next()
          } else {
            logger.log(
              { user_id, project_id },
              'denying user write access to project settings'
            )
            return AuthorizationMiddleware.redirectToRestricted(req, res, next)
          }
        }
      )
    })
  },

  ensureUserCanAdminProject(req, res, next) {
    return AuthorizationMiddleware._getUserAndProjectId(req, function(
      error,
      user_id,
      project_id
    ) {
      if (error != null) {
        return next(error)
      }
      const token = TokenAccessHandler.getRequestToken(req, project_id)
      return AuthorizationManager.canUserAdminProject(
        user_id,
        project_id,
        token,
        function(error, canAdmin) {
          if (error != null) {
            return next(error)
          }
          if (canAdmin) {
            logger.log(
              { user_id, project_id },
              'allowing user admin access to project'
            )
            return next()
          } else {
            logger.log(
              { user_id, project_id },
              'denying user admin access to project'
            )
            return AuthorizationMiddleware.redirectToRestricted(req, res, next)
          }
        }
      )
    })
  },

  ensureUserIsSiteAdmin(req, res, next) {
    return AuthorizationMiddleware._getUserId(req, function(error, user_id) {
      if (error != null) {
        return next(error)
      }
      return AuthorizationManager.isUserSiteAdmin(user_id, function(
        error,
        isAdmin
      ) {
        if (error != null) {
          return next(error)
        }
        if (isAdmin) {
          logger.log({ user_id }, 'allowing user admin access to site')
          return next()
        } else {
          logger.log({ user_id }, 'denying user admin access to site')
          return AuthorizationMiddleware.redirectToRestricted(req, res, next)
        }
      })
    })
  },

  _getUserAndProjectId(req, callback) {
    if (callback == null) {
      callback = function(error, user_id, project_id) {}
    }
    const project_id =
      (req.params != null ? req.params.project_id : undefined) ||
      (req.params != null ? req.params.Project_id : undefined)
    if (project_id == null) {
      return callback(new Error('Expected project_id in request parameters'))
    }
    if (!ObjectId.isValid(project_id)) {
      return callback(
        new Errors.NotFoundError(`invalid project_id: ${project_id}`)
      )
    }
    return AuthorizationMiddleware._getUserId(req, function(error, user_id) {
      if (error != null) {
        return callback(error)
      }
      return callback(null, user_id, project_id)
    })
  },

  _getUserId(req, callback) {
    if (callback == null) {
      callback = function(error, user_id) {}
    }
    const user_id =
      AuthenticationController.getLoggedInUserId(req) ||
      __guard__(req != null ? req.oauth_user : undefined, x => x._id) ||
      null
    return callback(null, user_id)
  },

  redirectToRestricted(req, res, next) {
    // TODO: move this to throwing ForbiddenError
    return res.redirect(`/restricted?from=${encodeURIComponent(req.url)}`)
  },

  restricted(req, res, next) {
    if (AuthenticationController.isUserLoggedIn(req)) {
      return res.render('user/restricted', { title: 'restricted' })
    } else {
      const { from } = req.query
      logger.log({ from }, 'redirecting to login')
      const redirect_to = '/login'
      if (from != null) {
        AuthenticationController.setRedirectInSession(req, from)
      }
      return res.redirect(redirect_to)
    }
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
