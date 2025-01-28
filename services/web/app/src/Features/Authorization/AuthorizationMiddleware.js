const AuthorizationManager = require('./AuthorizationManager')
const logger = require('@overleaf/logger')
const { ObjectId } = require('mongodb-legacy')
const Errors = require('../Errors/Errors')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const SessionManager = require('../Authentication/SessionManager')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')
const { expressify } = require('@overleaf/promise-utils')
const {
  canRedirectToAdminDomain,
} = require('../Helpers/AdminAuthorizationHelper')
const { getSafeAdminDomainRedirect } = require('../Helpers/UrlHelper')

function _handleAdminDomainRedirect(req, res) {
  if (canRedirectToAdminDomain(SessionManager.getSessionUser(req.session))) {
    logger.warn({ req }, 'redirecting admin user to admin domain')
    res.redirect(getSafeAdminDomainRedirect(req.originalUrl))
    return true
  }
  return false
}

async function ensureUserCanReadMultipleProjects(req, res, next) {
  const projectIds = (req.query.project_ids || '').split(',')
  const userId = _getUserId(req)
  for (const projectId of projectIds) {
    const token = TokenAccessHandler.getRequestToken(req, projectId)
    const canRead = await AuthorizationManager.promises.canUserReadProject(
      userId,
      projectId,
      token
    )
    if (!canRead) {
      return _redirectToRestricted(req, res, next)
    }
  }
  next()
}

async function blockRestrictedUserFromProject(req, res, next) {
  const projectId = _getProjectId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)
  const isRestrictedUser =
    await AuthorizationManager.promises.isRestrictedUserForProject(
      userId,
      projectId,
      token
    )
  if (isRestrictedUser) {
    return HttpErrorHandler.forbidden(req, res)
  }
  next()
}

async function ensureUserCanReadProject(req, res, next) {
  const projectId = _getProjectId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)
  const canRead = await AuthorizationManager.promises.canUserReadProject(
    userId,
    projectId,
    token
  )
  if (canRead) {
    logger.debug({ userId, projectId }, 'allowing user read access to project')
    return next()
  }
  logger.debug({ userId, projectId }, 'denying user read access to project')
  HttpErrorHandler.forbidden(req, res)
}

async function ensureUserCanWriteProjectSettings(req, res, next) {
  const projectId = _getProjectId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)

  if (req.body.name != null) {
    const canRename = await AuthorizationManager.promises.canUserRenameProject(
      userId,
      projectId,
      token
    )
    if (!canRename) {
      return HttpErrorHandler.forbidden(req, res)
    }
  }

  const otherParams = Object.keys(req.body).filter(x => x !== 'name')
  if (otherParams.length > 0) {
    const canWrite =
      await AuthorizationManager.promises.canUserWriteProjectSettings(
        userId,
        projectId,
        token
      )
    if (!canWrite) {
      return HttpErrorHandler.forbidden(req, res)
    }
  }

  next()
}

async function ensureUserCanDeleteOrResolveThread(req, res, next) {
  const projectId = _getProjectId(req)
  const docId = _getDocId(req)
  const threadId = _getThreadId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)
  const canDeleteThread =
    await AuthorizationManager.promises.canUserDeleteOrResolveThread(
      userId,
      projectId,
      docId,
      threadId,
      token
    )
  if (canDeleteThread) {
    logger.debug(
      { userId, projectId },
      'allowing user to delete or resolve a comment thread'
    )
    return next()
  }

  logger.debug(
    { userId, projectId, threadId },
    'denying user to delete or resolve a comment thread'
  )
  return HttpErrorHandler.forbidden(req, res)
}

async function ensureUserCanWriteProjectContent(req, res, next) {
  const projectId = _getProjectId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)
  const canWrite =
    await AuthorizationManager.promises.canUserWriteProjectContent(
      userId,
      projectId,
      token
    )
  if (canWrite) {
    logger.debug(
      { userId, projectId },
      'allowing user write access to project content'
    )
    return next()
  }
  logger.debug(
    { userId, projectId },
    'denying user write access to project settings'
  )
  HttpErrorHandler.forbidden(req, res)
}

async function ensureUserCanWriteOrReviewProjectContent(req, res, next) {
  const projectId = _getProjectId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)

  const canWriteOrReviewProjectContent =
    await AuthorizationManager.promises.canUserWriteOrReviewProjectContent(
      userId,
      projectId,
      token
    )
  if (canWriteOrReviewProjectContent) {
    logger.debug(
      { userId, projectId },
      'allowing user write or review access to project content'
    )
    return next()
  }

  logger.debug(
    { userId, projectId },
    'denying user write or review access to project content'
  )
  return HttpErrorHandler.forbidden(req, res)
}

async function ensureUserCanAdminProject(req, res, next) {
  const projectId = _getProjectId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)
  const canAdmin = await AuthorizationManager.promises.canUserAdminProject(
    userId,
    projectId,
    token
  )
  if (canAdmin) {
    logger.debug({ userId, projectId }, 'allowing user admin access to project')
    return next()
  }
  logger.debug({ userId, projectId }, 'denying user admin access to project')
  HttpErrorHandler.forbidden(req, res)
}

async function ensureUserIsSiteAdmin(req, res, next) {
  const userId = _getUserId(req)
  if (await AuthorizationManager.promises.isUserSiteAdmin(userId)) {
    logger.debug({ userId }, 'allowing user admin access to site')
    return next()
  }
  if (_handleAdminDomainRedirect(req, res)) return
  logger.debug({ userId }, 'denying user admin access to site')
  _redirectToRestricted(req, res, next)
}

function _getProjectId(req) {
  const projectId = req.params.project_id || req.params.Project_id
  if (!projectId) {
    throw new Error('Expected project_id in request parameters')
  }
  if (!ObjectId.isValid(projectId)) {
    throw new Errors.NotFoundError(`invalid projectId: ${projectId}`)
  }
  return projectId
}

function _getDocId(req) {
  const docId = req.params.doc_id
  if (!docId) {
    throw new Error('Expected doc_id in request parameters')
  }
  if (!ObjectId.isValid(docId)) {
    throw new Errors.NotFoundError(`invalid docId: ${docId}`)
  }
  return docId
}

function _getThreadId(req) {
  const threadId = req.params.thread_id
  if (!threadId) {
    throw new Error('Expected thread_id in request parameters')
  }
  if (!ObjectId.isValid(threadId)) {
    throw new Errors.NotFoundError(`invalid threadId: ${threadId}`)
  }
  return threadId
}

function _getUserId(req) {
  return (
    SessionManager.getLoggedInUserId(req.session) ||
    (req.oauth_user && req.oauth_user._id) ||
    null
  )
}

function _redirectToRestricted(req, res, next) {
  // TODO: move this to throwing ForbiddenError
  res.redirect(`/restricted?from=${encodeURIComponent(res.locals.currentUrl)}`)
}

function restricted(req, res, next) {
  if (SessionManager.isUserLoggedIn(req.session)) {
    return res.render('user/restricted', { title: 'restricted' })
  }
  const { from } = req.query
  logger.debug({ from }, 'redirecting to login')
  if (from) {
    AuthenticationController.setRedirectInSession(req, from)
  }
  res.redirect('/login')
}

module.exports = {
  ensureUserCanReadMultipleProjects: expressify(
    ensureUserCanReadMultipleProjects
  ),
  blockRestrictedUserFromProject: expressify(blockRestrictedUserFromProject),
  ensureUserCanReadProject: expressify(ensureUserCanReadProject),
  ensureUserCanWriteProjectSettings: expressify(
    ensureUserCanWriteProjectSettings
  ),
  ensureUserCanDeleteOrResolveThread: expressify(
    ensureUserCanDeleteOrResolveThread
  ),
  ensureUserCanWriteProjectContent: expressify(
    ensureUserCanWriteProjectContent
  ),
  ensureUserCanWriteOrReviewProjectContent: expressify(
    ensureUserCanWriteOrReviewProjectContent
  ),
  ensureUserCanAdminProject: expressify(ensureUserCanAdminProject),
  ensureUserIsSiteAdmin: expressify(ensureUserIsSiteAdmin),
  restricted,
}
