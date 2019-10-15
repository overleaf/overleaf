const OError = require('@overleaf/o-error')
const HttpErrors = require('@overleaf/o-error/http')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const CollaboratorsGetter = require('./CollaboratorsGetter')
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
  setCollaboratorInfo: expressify(setCollaboratorInfo)
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

async function _removeUserIdFromProject(projectId, userId) {
  await CollaboratorsHandler.promises.removeUserFromProject(projectId, userId)
  EditorRealTimeController.emitToRoom(
    projectId,
    'userRemovedFromProject',
    userId
  )
  await TagsHandler.promises.removeProjectFromAllTags(userId, projectId)
}
