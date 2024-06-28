const OError = require('@overleaf/o-error')
const HttpErrorHandler = require('../../Features/Errors/HttpErrorHandler')
const { ObjectId } = require('mongodb')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const CollaboratorsGetter = require('./CollaboratorsGetter')
const OwnershipTransferHandler = require('./OwnershipTransferHandler')
const SessionManager = require('../Authentication/SessionManager')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const TagsHandler = require('../Tags/TagsHandler')
const Errors = require('../Errors/Errors')
const logger = require('@overleaf/logger')
const { expressify } = require('@overleaf/promise-utils')
const { hasAdminAccess } = require('../Helpers/AdminAuthorizationHelper')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')
const ProjectAuditLogHandler = require('../Project/ProjectAuditLogHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const LimitationsManager = require('../Subscription/LimitationsManager')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')

module.exports = {
  removeUserFromProject: expressify(removeUserFromProject),
  removeSelfFromProject: expressify(removeSelfFromProject),
  getAllMembers: expressify(getAllMembers),
  setCollaboratorInfo: expressify(setCollaboratorInfo),
  transferOwnership: expressify(transferOwnership),
  getShareTokens: expressify(getShareTokens),
}

async function removeUserFromProject(req, res, next) {
  const projectId = req.params.Project_id
  const userId = req.params.user_id
  const sessionUserId = SessionManager.getLoggedInUserId(req.session)
  await _removeUserIdFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    members: true,
  })

  ProjectAuditLogHandler.addEntryInBackground(
    projectId,
    'remove-collaborator',
    sessionUserId,
    req.ip,
    { userId }
  )

  res.sendStatus(204)
}

async function removeSelfFromProject(req, res, next) {
  const projectId = req.params.Project_id
  const userId = SessionManager.getLoggedInUserId(req.session)
  await _removeUserIdFromProject(projectId, userId)

  ProjectAuditLogHandler.addEntryInBackground(
    projectId,
    'leave-project',
    userId,
    req.ip
  )

  res.sendStatus(204)
}

async function getAllMembers(req, res, next) {
  const projectId = req.params.Project_id
  logger.debug({ projectId }, 'getting all active members for project')
  let members
  try {
    members = await CollaboratorsGetter.promises.getAllInvitedMembers(projectId)
  } catch (err) {
    throw OError.tag(err, 'error getting members for project', { projectId })
  }
  res.json({ members })
}

async function setCollaboratorInfo(req, res, next) {
  try {
    const projectId = req.params.Project_id
    const userId = req.params.user_id
    const { privilegeLevel } = req.body

    if (privilegeLevel !== PrivilegeLevels.READ_ONLY) {
      const project = await ProjectGetter.promises.getProject(projectId, {
        owner_ref: 1,
      })
      const linkSharingChanges =
        await SplitTestHandler.promises.getAssignmentForUser(
          project.owner_ref,
          'link-sharing-warning'
        )
      const allowed =
        await LimitationsManager.promises.canAddXEditCollaborators(projectId, 1)
      if (linkSharingChanges?.variant === 'active') {
        if (!allowed) {
          return HttpErrorHandler.forbidden(
            req,
            res,
            'edit collaborator limit reached'
          )
        }
      }
    }
    await CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
      projectId,
      userId,
      privilegeLevel
    )
    EditorRealTimeController.emitToRoom(
      projectId,
      'project:collaboratorAccessLevel:changed',
      { userId }
    )
    res.sendStatus(204)
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      HttpErrorHandler.notFound(req, res)
    } else {
      next(err)
    }
  }
}

async function transferOwnership(req, res, next) {
  const sessionUser = SessionManager.getSessionUser(req.session)
  const projectId = req.params.Project_id
  const toUserId = req.body.user_id
  try {
    await OwnershipTransferHandler.promises.transferOwnership(
      projectId,
      toUserId,
      {
        allowTransferToNonCollaborators: hasAdminAccess(sessionUser),
        sessionUserId: new ObjectId(sessionUser._id),
      }
    )
    res.sendStatus(204)
  } catch (err) {
    if (err instanceof Errors.ProjectNotFoundError) {
      HttpErrorHandler.notFound(req, res, `project not found: ${projectId}`)
    } else if (err instanceof Errors.UserNotFoundError) {
      HttpErrorHandler.notFound(req, res, `user not found: ${toUserId}`)
    } else if (err instanceof Errors.UserNotCollaboratorError) {
      HttpErrorHandler.forbidden(
        req,
        res,
        `user ${toUserId} should be a collaborator in project ${projectId} prior to ownership transfer`
      )
    } else {
      next(err)
    }
  }
}

async function _removeUserIdFromProject(projectId, userId) {
  await CollaboratorsHandler.promises.removeUserFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(
    projectId,
    'userRemovedFromProject',
    userId
  )
  await TagsHandler.promises.removeProjectFromAllTags(userId, projectId)
}

async function getShareTokens(req, res) {
  const projectId = req.params.Project_id
  const userId = SessionManager.getLoggedInUserId(req.session)

  let tokens
  if (userId) {
    tokens = await CollaboratorsGetter.promises.getPublicShareTokens(
      new ObjectId(userId),
      new ObjectId(projectId)
    )
  } else {
    // anonymous access, the token is already available in the session
    const readOnly = TokenAccessHandler.getRequestToken(req, projectId)
    tokens = { readOnly }
  }
  if (!tokens) {
    return res.sendStatus(403)
  }

  if (tokens.readOnly || tokens.readAndWrite) {
    logger.info(
      {
        projectId,
        userId: userId || 'anonymous',
        ip: req.ip,
        tokens: Object.keys(tokens),
      },
      'project tokens accessed'
    )
  }

  if (tokens.readOnly) {
    tokens.readOnlyHashPrefix = TokenAccessHandler.createTokenHashPrefix(
      tokens.readOnly
    )
  }

  if (tokens.readAndWrite) {
    tokens.readAndWriteHashPrefix = TokenAccessHandler.createTokenHashPrefix(
      tokens.readAndWrite
    )
  }

  res.json(tokens)
}
