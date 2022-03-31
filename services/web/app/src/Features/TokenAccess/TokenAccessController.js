const AuthenticationController = require('../Authentication/AuthenticationController')
const SessionManager = require('../Authentication/SessionManager')
const TokenAccessHandler = require('./TokenAccessHandler')
const Errors = require('../Errors/Errors')
const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const { expressify } = require('../../util/promises')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const {
  handleAdminDomainRedirect,
} = require('../Authorization/AuthorizationMiddleware')

const orderedPrivilegeLevels = [
  PrivilegeLevels.NONE,
  PrivilegeLevels.READ_ONLY,
  PrivilegeLevels.READ_AND_WRITE,
  PrivilegeLevels.OWNER,
]

async function _userAlreadyHasHigherPrivilege(
  userId,
  projectId,
  token,
  tokenType
) {
  if (!Object.values(TokenAccessHandler.TOKEN_TYPES).includes(tokenType)) {
    throw new Error('bad token type')
  }
  const privilegeLevel =
    await AuthorizationManager.promises.getPrivilegeLevelForProject(
      userId,
      projectId,
      token
    )
  return (
    orderedPrivilegeLevels.indexOf(privilegeLevel) >=
    orderedPrivilegeLevels.indexOf(tokenType)
  )
}

const makePostUrl = token => {
  if (TokenAccessHandler.isReadAndWriteToken(token)) {
    return `/${token}/grant`
  } else if (TokenAccessHandler.isReadOnlyToken(token)) {
    return `/read/${token}/grant`
  } else {
    throw new Error('invalid token type')
  }
}

async function _handleV1Project(token, userId) {
  if (!userId) {
    return { v1Import: { status: 'mustLogin' } }
  } else {
    const docInfo = await TokenAccessHandler.promises.getV1DocInfo(
      token,
      userId
    )
    // This should not happen anymore, but it does show
    // a nice "contact support" message, so it can stay
    if (!docInfo) {
      return { v1Import: { status: 'cannotImport' } }
    }
    if (!docInfo.exists) {
      return null
    }
    if (docInfo.exported) {
      return null
    }
    return {
      v1Import: {
        status: 'canDownloadZip',
        projectId: token,
        hasOwner: docInfo.has_owner,
        name: docInfo.name || 'Untitled',
        brandInfo: docInfo.brand_info,
      },
    }
  }
}

async function tokenAccessPage(req, res, next) {
  const { token } = req.params
  if (!TokenAccessHandler.isValidToken(token)) {
    return next(new Errors.NotFoundError())
  }
  if (handleAdminDomainRedirect(req, res)) {
    // Admin users do not join the project, but view it on the admin domain.
    return
  }
  try {
    if (TokenAccessHandler.isReadOnlyToken(token)) {
      const docPublishedInfo =
        await TokenAccessHandler.promises.getV1DocPublishedInfo(token)
      if (docPublishedInfo.allow === false) {
        return res.redirect(302, docPublishedInfo.published_path)
      }
    }
    res.render('project/token/access', {
      postUrl: makePostUrl(token),
    })
  } catch (err) {
    return next(
      OError.tag(err, 'error while rendering token access page', { token })
    )
  }
}

async function checkAndGetProjectOrResponseAction(
  tokenType,
  token,
  userId,
  req,
  res,
  next
) {
  // Try to get the project, and/or an alternative action to take.
  // Returns a tuple of [project, action]
  const project = await TokenAccessHandler.promises.getProjectByToken(
    tokenType,
    token
  )
  if (!project) {
    if (settings.overleaf) {
      const v1ImportData = await _handleV1Project(token, userId)
      return [
        null,
        () => {
          if (v1ImportData) {
            res.json(v1ImportData)
          } else {
            res.sendStatus(404)
          }
        },
      ]
    } else {
      return [null, null]
    }
  }

  const projectId = project._id
  const isAnonymousUser = !userId
  const tokenAccessEnabled =
    TokenAccessHandler.tokenAccessEnabledForProject(project)
  if (isAnonymousUser && tokenAccessEnabled) {
    if (tokenType === TokenAccessHandler.TOKEN_TYPES.READ_AND_WRITE) {
      if (TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED) {
        logger.info({ projectId }, 'granting read-write anonymous access')
        TokenAccessHandler.grantSessionTokenAccess(req, projectId, token)
        return [
          null,
          () => {
            res.json({
              redirect: `/project/${projectId}`,
              grantAnonymousAccess: tokenType,
            })
          },
        ]
      } else {
        logger.warn(
          { projectId },
          '[TokenAccess] deny anonymous read-and-write token access'
        )
        AuthenticationController.setRedirectInSession(
          req,
          TokenAccessHandler.makeTokenUrl(token)
        )
        return [
          null,
          () => {
            res.json({
              redirect: '/restricted',
              anonWriteAccessDenied: true,
            })
          },
        ]
      }
    } else if (tokenType === TokenAccessHandler.TOKEN_TYPES.READ_ONLY) {
      logger.info({ projectId }, 'granting read-only anonymous access')
      TokenAccessHandler.grantSessionTokenAccess(req, projectId, token)
      return [
        null,
        () => {
          res.json({
            redirect: `/project/${projectId}`,
            grantAnonymousAccess: tokenType,
          })
        },
      ]
    } else {
      throw new Error('unreachable')
    }
  }
  const userHasPrivilege = await _userAlreadyHasHigherPrivilege(
    userId,
    projectId,
    token,
    tokenType
  )
  if (userHasPrivilege) {
    return [
      null,
      () => {
        res.json({ redirect: `/project/${project._id}`, higherAccess: true })
      },
    ]
  }
  if (!tokenAccessEnabled) {
    return [
      null,
      () => {
        next(new Errors.NotFoundError())
      },
    ]
  }
  return [project, null]
}

async function grantTokenAccessReadAndWrite(req, res, next) {
  const { token } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (!TokenAccessHandler.isReadAndWriteToken(token)) {
    return res.sendStatus(400)
  }
  const tokenType = TokenAccessHandler.TOKEN_TYPES.READ_AND_WRITE
  try {
    const [project, action] = await checkAndGetProjectOrResponseAction(
      tokenType,
      token,
      userId,
      req,
      res,
      next
    )
    if (action) {
      return action()
    }
    if (!project) {
      return next(new Errors.NotFoundError())
    }
    await TokenAccessHandler.promises.addReadAndWriteUserToProject(
      userId,
      project._id
    )
    return res.json({
      redirect: `/project/${project._id}`,
      tokenAccessGranted: tokenType,
    })
  } catch (err) {
    return next(
      OError.tag(
        err,
        'error while trying to grant read-and-write token access',
        { token }
      )
    )
  }
}

async function grantTokenAccessReadOnly(req, res, next) {
  const { token } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (!TokenAccessHandler.isReadOnlyToken(token)) {
    return res.sendStatus(400)
  }
  const tokenType = TokenAccessHandler.TOKEN_TYPES.READ_ONLY
  const docPublishedInfo =
    await TokenAccessHandler.promises.getV1DocPublishedInfo(token)
  if (docPublishedInfo.allow === false) {
    return res.json({ redirect: docPublishedInfo.published_path })
  }
  try {
    const [project, action] = await checkAndGetProjectOrResponseAction(
      tokenType,
      token,
      userId,
      req,
      res,
      next
    )
    if (action) {
      return action()
    }
    if (!project) {
      return next(new Errors.NotFoundError())
    }
    await TokenAccessHandler.promises.addReadOnlyUserToProject(
      userId,
      project._id
    )
    return res.json({
      redirect: `/project/${project._id}`,
      tokenAccessGranted: tokenType,
    })
  } catch (err) {
    return next(
      OError.tag(err, 'error while trying to grant read-only token access', {
        token,
      })
    )
  }
}

module.exports = {
  READ_ONLY_TOKEN_PATTERN: TokenAccessHandler.READ_ONLY_TOKEN_PATTERN,
  READ_AND_WRITE_TOKEN_PATTERN: TokenAccessHandler.READ_AND_WRITE_TOKEN_PATTERN,

  tokenAccessPage: expressify(tokenAccessPage),
  grantTokenAccessReadOnly: expressify(grantTokenAccessReadOnly),
  grantTokenAccessReadAndWrite: expressify(grantTokenAccessReadAndWrite),
}
