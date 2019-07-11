/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let TokenAccessController
const ProjectController = require('../Project/ProjectController')
const AuthenticationController = require('../Authentication/AuthenticationController')
const TokenAccessHandler = require('./TokenAccessHandler')
const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')

module.exports = TokenAccessController = {
  _loadEditor(projectId, req, res, next) {
    req.params.Project_id = projectId.toString()
    return ProjectController.loadEditor(req, res, next)
  },

  _tryHigherAccess(token, userId, req, res, next) {
    return TokenAccessHandler.findProjectWithHigherAccess(
      token,
      userId,
      function(err, project) {
        if (err != null) {
          logger.warn(
            { err, token, userId },
            '[TokenAccess] error finding project with higher access'
          )
          return next(err)
        }
        if (project == null) {
          logger.log(
            { token, userId },
            '[TokenAccess] no project with higher access found for this user and token'
          )
          return next(new Errors.NotFoundError())
        }
        logger.log(
          { token, userId, projectId: project._id },
          '[TokenAccess] user has higher access to project, redirecting'
        )
        return res.redirect(302, `/project/${project._id}`)
      }
    )
  },

  readAndWriteToken(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const token = req.params['read_and_write_token']
    logger.log(
      { userId, token },
      '[TokenAccess] requesting read-and-write token access'
    )
    return TokenAccessHandler.findProjectWithReadAndWriteToken(token, function(
      err,
      project,
      projectExists
    ) {
      if (err != null) {
        logger.warn(
          { err, token, userId },
          '[TokenAccess] error getting project by readAndWrite token'
        )
        return next(err)
      }
      if (!projectExists && settings.overleaf) {
        logger.log(
          { token, userId },
          '[TokenAccess] no project found for this token'
        )
        return TokenAccessController._handleV1Project(
          token,
          userId,
          `/${token}`,
          res,
          next
        )
      } else if (project == null) {
        logger.log(
          { token, userId },
          '[TokenAccess] no token-based project found for readAndWrite token'
        )
        if (userId == null) {
          logger.log(
            { token },
            '[TokenAccess] No project found with read-write token, anonymous user, deny'
          )
          return next(new Errors.NotFoundError())
        }
        return TokenAccessController._tryHigherAccess(
          token,
          userId,
          req,
          res,
          next
        )
      } else {
        if (userId == null) {
          if (TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED) {
            logger.log(
              { token, projectId: project._id },
              '[TokenAccess] allow anonymous read-and-write token access'
            )
            TokenAccessHandler.grantSessionTokenAccess(req, project._id, token)
            req._anonymousAccessToken = token
            return TokenAccessController._loadEditor(
              project._id,
              req,
              res,
              next
            )
          } else {
            logger.log(
              { token, projectId: project._id },
              '[TokenAccess] deny anonymous read-and-write token access'
            )
            AuthenticationController.setRedirectInSession(req)
            return res.redirect('/restricted')
          }
        }
        if (project.owner_ref.toString() === userId) {
          logger.log(
            { userId, projectId: project._id },
            '[TokenAccess] user is already project owner'
          )
          return TokenAccessController._loadEditor(project._id, req, res, next)
        }
        logger.log(
          { userId, projectId: project._id },
          '[TokenAccess] adding user to project with readAndWrite token'
        )
        return TokenAccessHandler.addReadAndWriteUserToProject(
          userId,
          project._id,
          function(err) {
            if (err != null) {
              logger.warn(
                { err, token, userId, projectId: project._id },
                '[TokenAccess] error adding user to project with readAndWrite token'
              )
              return next(err)
            }
            return TokenAccessController._loadEditor(
              project._id,
              req,
              res,
              next
            )
          }
        )
      }
    })
  },

  readOnlyToken(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const token = req.params['read_only_token']
    logger.log(
      { userId, token },
      '[TokenAccess] requesting read-only token access'
    )
    return TokenAccessHandler.getV1DocPublishedInfo(token, function(
      err,
      doc_published_info
    ) {
      if (err != null) {
        return next(err)
      }
      if (doc_published_info.allow === false) {
        return res.redirect(doc_published_info.published_path)
      }

      return TokenAccessHandler.findProjectWithReadOnlyToken(token, function(
        err,
        project,
        projectExists
      ) {
        if (err != null) {
          logger.warn(
            { err, token, userId },
            '[TokenAccess] error getting project by readOnly token'
          )
          return next(err)
        }
        if (!projectExists && settings.overleaf) {
          logger.log(
            { token, userId },
            '[TokenAccess] no project found for this token'
          )
          return TokenAccessController._handleV1Project(
            token,
            userId,
            `/read/${token}`,
            res,
            next
          )
        } else if (project == null) {
          logger.log(
            { token, userId },
            '[TokenAccess] no project found for readOnly token'
          )
          if (userId == null) {
            logger.log(
              { token },
              '[TokenAccess] No project found with readOnly token, anonymous user, deny'
            )
            return next(new Errors.NotFoundError())
          }
          return TokenAccessController._tryHigherAccess(
            token,
            userId,
            req,
            res,
            next
          )
        } else {
          if (userId == null) {
            logger.log(
              { userId, projectId: project._id },
              '[TokenAccess] adding anonymous user to project with readOnly token'
            )
            TokenAccessHandler.grantSessionTokenAccess(req, project._id, token)
            req._anonymousAccessToken = token
            return TokenAccessController._loadEditor(
              project._id,
              req,
              res,
              next
            )
          } else {
            if (project.owner_ref.toString() === userId) {
              logger.log(
                { userId, projectId: project._id },
                '[TokenAccess] user is already project owner'
              )
              return TokenAccessController._loadEditor(
                project._id,
                req,
                res,
                next
              )
            }
            logger.log(
              { userId, projectId: project._id },
              '[TokenAccess] adding user to project with readOnly token'
            )
            return TokenAccessHandler.addReadOnlyUserToProject(
              userId,
              project._id,
              function(err) {
                if (err != null) {
                  logger.warn(
                    { err, token, userId, projectId: project._id },
                    '[TokenAccess] error adding user to project with readAndWrite token'
                  )
                  return next(err)
                }
                return TokenAccessController._loadEditor(
                  project._id,
                  req,
                  res,
                  next
                )
              }
            )
          }
        }
      })
    })
  },

  _handleV1Project(token, userId, redirectPath, res, next) {
    if (userId == null) {
      return res.render('project/v2-import', { loginRedirect: redirectPath })
    } else {
      TokenAccessHandler.getV1DocInfo(token, userId, function(err, doc_info) {
        if (err != null) {
          return next(err)
        }
        if (!doc_info) {
          res.status(400)
          return res.render('project/cannot-import-v1-project')
        }
        if (!doc_info.exists) {
          return next(new Errors.NotFoundError())
        }
        if (doc_info.exported) {
          return next(new Errors.NotFoundError())
        }
        return res.render('project/v2-import', {
          projectId: token,
          hasOwner: doc_info.has_owner,
          name: doc_info.name || 'Untitled',
          hasAssignment: doc_info.has_assignment,
          brandInfo: doc_info.brand_info
        })
      })
    }
  }
}
