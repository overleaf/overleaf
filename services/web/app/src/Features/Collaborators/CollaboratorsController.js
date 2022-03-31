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
const { expressify } = require('../../util/promises')
const { hasAdminAccess } = require('../Helpers/AdminAuthorizationHelper')

module.exports = {
  removeUserFromProject: expressify(removeUserFromProject),
  removeSelfFromProject: expressify(removeSelfFromProject),
  getAllMembers: expressify(getAllMembers),
  setCollaboratorInfo: expressify(setCollaboratorInfo),
  transferOwnership: expressify(transferOwnership),
}

async function removeUserFromProject(req, res, next) {
  const projectId = req.params.Project_id
  const userId = req.params.user_id
  await _removeUserIdFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    members: true,
  })
  res.sendStatus(204)
}

async function removeSelfFromProject(req, res, next) {
  const projectId = req.params.Project_id
  const userId = SessionManager.getLoggedInUserId(req.session)
  await _removeUserIdFromProject(projectId, userId)
  res.sendStatus(204)
}

async function getAllMembers(req, res, next) {
  const projectId = req.params.Project_id
  logger.log({ projectId }, 'getting all active members for project')
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
    await CollaboratorsHandler.promises.setCollaboratorPrivilegeLevel(
      projectId,
      userId,
      privilegeLevel
    )
    EditorRealTimeController.emitToRoom(
      projectId,
      'project:membership:changed',
      { members: true }
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
        sessionUserId: ObjectId(sessionUser._id),
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
