import AuthorizationManager from './AuthorizationManager.mjs'
import logger from '@overleaf/logger'

import HttpErrorHandler from '../Errors/HttpErrorHandler.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import TokenAccessHandler from '../TokenAccess/TokenAccessHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import AdminAuthorizationHelper from '../Helpers/AdminAuthorizationHelper.mjs'
import UrlHelper from '../Helpers/UrlHelper.mjs'
import ChatApiHandler from '../Chat/ChatApiHandler.mjs'
import {
  getRawReqInput,
  parseReq,
  z,
  zz,
} from '../../infrastructure/Validation.mjs'

// middleware schemas are non-strict: they validate only the fields this
// middleware consumes; the route schema stays responsible for strictness
const projectIdsQuerySchema = z.object({
  query: z.object({ project_ids: z.string().optional() }),
})

const projectIdParamsSchema = z.object({
  params: z.object({
    project_id: zz.objectId().optional(),
    Project_id: zz.objectId().optional(),
  }),
})

const threadIdParamsSchema = z.object({
  params: z.object({ thread_id: zz.objectId().optional() }),
})

const messageIdParamsSchema = z.object({
  params: z.object({ message_id: zz.objectId().optional() }),
})

const settingsBodySchema = z.object({
  body: z.object({ name: z.string().optional() }),
})

const restrictedQuerySchema = z.object({
  query: z.object({ from: z.string().optional() }),
})

function _handleAdminDomainRedirect(req, res) {
  if (
    AdminAuthorizationHelper.canRedirectToAdminDomain(
      SessionManager.getSessionUser(req.session)
    )
  ) {
    logger.warn({ req }, 'redirecting admin user to admin domain')
    res.redirect(UrlHelper.getSafeAdminDomainRedirect(req.originalUrl))
    return true
  }
  return false
}

async function ensureUserCanReadMultipleProjects(req, res, next) {
  const { query } = parseReq(req, projectIdsQuerySchema, { logOnly: true })
  const projectIds = (query.project_ids || '').split(',')
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
  const { body } = parseReq(req, settingsBodySchema, { logOnly: true })

  if (body.name != null) {
    const canRename = await AuthorizationManager.promises.canUserRenameProject(
      userId,
      projectId,
      token
    )
    if (!canRename) {
      return HttpErrorHandler.forbidden(req, res)
    }
  }

  // raw access justified: inspects the key set (not the values) to decide
  // which authorization check applies; the route schema validates the values
  const otherParams = Object.keys(getRawReqInput(req).body).filter(
    x => x !== 'name'
  )
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
  const threadId = _getThreadId(req)
  const userId = _getUserId(req)
  const token = TokenAccessHandler.getRequestToken(req, projectId)
  const canDeleteThread =
    await AuthorizationManager.promises.canUserDeleteOrResolveThread(
      userId,
      projectId,
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

async function ensureUserIsMessageAuthor(req, res, next) {
  const projectId = _getProjectId(req)
  const messageId = _getMessageId(req)
  const userId = _getUserId(req)

  if (!userId) {
    logger.debug({ projectId, messageId }, 'denying access: no logged in user')
    return HttpErrorHandler.forbidden(req, res)
  }

  const message = await ChatApiHandler.promises.getGlobalMessage(
    projectId,
    messageId
  )
  if (message.user_id === userId) {
    logger.debug(
      { userId, projectId, messageId },
      'allowing user to modify their own message'
    )
    return next()
  }
  logger.debug(
    { userId, projectId, messageId, messageAuthor: message.user_id },
    'denying user access to modify message: not the author'
  )
  return HttpErrorHandler.forbidden(req, res)
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
  const { params } = parseReq(req, projectIdParamsSchema)
  const projectId = params.project_id || params.Project_id
  if (!projectId) {
    throw new Error('Expected project_id in request parameters')
  }
  return projectId
}

function _getThreadId(req) {
  const threadId = parseReq(req, threadIdParamsSchema).params.thread_id
  if (!threadId) {
    throw new Error('Expected thread_id in request parameters')
  }
  return threadId
}

function _getMessageId(req) {
  const messageId = parseReq(req, messageIdParamsSchema).params.message_id
  if (!messageId) {
    throw new Error('Expected message_id in request parameters')
  }
  return messageId
}

function _getUserId(req) {
  return (
    SessionManager.getLoggedInUserId(req.session) ||
    (req.oauth_user && req.oauth_user._id?.toString()) ||
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
  const { from } = parseReq(req, restrictedQuerySchema, {
    logOnly: true,
  }).query
  logger.debug({ from }, 'redirecting to login')
  if (from) {
    AuthenticationController.setRedirectInSession(req, from)
  }
  res.redirect('/login')
}

export default {
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
  ensureUserIsMessageAuthor: expressify(ensureUserIsMessageAuthor),
  restricted,
}
