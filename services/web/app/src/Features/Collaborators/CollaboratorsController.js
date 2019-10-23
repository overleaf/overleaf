const OError = require('@overleaf/o-error')
const HttpErrors = require('@overleaf/o-error/http')
const { ObjectId } = require('mongodb')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const CollaboratorsGetter = require('./CollaboratorsGetter')
const OwnershipTransferHandler = require('./OwnershipTransferHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const TagsHandler = require('../Tags/TagsHandler')
const Errors = require('../Errors/Errors')
const logger = require('logger-sharelatex')
const { expressify } = require('../../util/promises')

module.exports = {
  removeUserFromProject: expressify(removeUserFromProject),
  removeSelfFromProject: expressify(removeSelfFromProject),
  getAllMembers: expressify(getAllMembers),
  setCollaboratorInfo: expressify(setCollaboratorInfo),
  transferOwnership: expressify(transferOwnership)
}

async function removeUserFromProject(req, res, next) {
  const projectId = req.params.Project_id
  const userId = req.params.user_id
  await _removeUserIdFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(projectId, 'project:membership:changed', {
    members: true
  })
  res.sendStatus(204)
}

async function removeSelfFromProject(req, res, next) {
  const projectId = req.params.Project_id
  const userId = AuthenticationController.getLoggedInUserId(req)
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
    throw new OError({
      message: 'error getting members for project',
      info: { projectId }
    }).withCause(err)
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
      throw new HttpErrors.NotFoundError({})
    } else {
      throw new HttpErrors.InternalServerError({}).withCause(err)
    }
  }
}

async function transferOwnership(req, res, next) {
  const sessionUser = AuthenticationController.getSessionUser(req)
  const projectId = req.params.Project_id
  const toUserId = req.body.user_id
  try {
    await OwnershipTransferHandler.promises.transferOwnership(
      projectId,
      toUserId,
      {
        allowTransferToNonCollaborators: sessionUser.isAdmin,
        sessionUserId: ObjectId(sessionUser._id)
      }
    )
    res.sendStatus(204)
  } catch (err) {
    if (err instanceof Errors.ProjectNotFoundError) {
      throw new HttpErrors.NotFoundError({
        info: { public: { message: `project not found: ${projectId}` } }
      })
    } else if (err instanceof Errors.UserNotFoundError) {
      throw new HttpErrors.NotFoundError({
        info: { public: { message: `user not found: ${toUserId}` } }
      })
    } else if (err instanceof Errors.UserNotCollaboratorError) {
      throw new HttpErrors.ForbiddenError({
        info: {
          public: {
            message: `user ${toUserId} should be a collaborator in project ${projectId} prior to ownership transfer`
          }
        }
      })
    } else {
      throw new HttpErrors.InternalServerError({}).withCause(err)
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
