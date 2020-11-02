const logger = require('logger-sharelatex')
const { Project } = require('../../models/Project')
const ProjectGetter = require('../Project/ProjectGetter')
const UserGetter = require('../User/UserGetter')
const CollaboratorsHandler = require('./CollaboratorsHandler')
const EmailHandler = require('../Email/EmailHandler')
const Errors = require('../Errors/Errors')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const TpdsProjectFlusher = require('../ThirdPartyDataStore/TpdsProjectFlusher')
const ProjectAuditLogHandler = require('../Project/ProjectAuditLogHandler')

module.exports = {
  promises: { transferOwnership }
}

async function transferOwnership(projectId, newOwnerId, options = {}) {
  const { allowTransferToNonCollaborators, sessionUserId } = options

  // Fetch project and user
  const [project, newOwner] = await Promise.all([
    _getProject(projectId),
    _getUser(newOwnerId)
  ])

  // Exit early if the transferee is already the project owner
  const previousOwnerId = project.owner_ref
  if (previousOwnerId.equals(newOwnerId)) {
    return
  }

  // Check that user is already a collaborator
  if (
    !allowTransferToNonCollaborators &&
    !_userIsCollaborator(newOwner, project)
  ) {
    throw new Errors.UserNotCollaboratorError({ info: { userId: newOwnerId } })
  }

  // Transfer ownership
  await ProjectAuditLogHandler.promises.addEntry(
    projectId,
    'transfer-ownership',
    sessionUserId,
    { previousOwnerId, newOwnerId }
  )
  await _transferOwnership(projectId, previousOwnerId, newOwnerId)

  // Flush project to TPDS
  await TpdsProjectFlusher.promises.flushProjectToTpds(projectId)

  // Send confirmation emails
  const previousOwner = await UserGetter.promises.getUser(previousOwnerId)
  await _sendEmails(project, previousOwner, newOwner)
}

async function _getProject(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    collaberator_refs: 1,
    name: 1
  })
  if (project == null) {
    throw new Errors.ProjectNotFoundError({ info: { projectId } })
  }
  return project
}

async function _getUser(userId) {
  const user = await UserGetter.promises.getUser(userId)
  if (user == null) {
    throw new Errors.UserNotFoundError({ info: { userId } })
  }
  return user
}

function _userIsCollaborator(user, project) {
  const collaboratorIds = project.collaberator_refs || []
  return collaboratorIds.some(collaboratorId => collaboratorId.equals(user._id))
}

async function _transferOwnership(projectId, previousOwnerId, newOwnerId) {
  await CollaboratorsHandler.promises.removeUserFromProject(
    projectId,
    newOwnerId
  )
  await Project.update(
    { _id: projectId },
    { $set: { owner_ref: newOwnerId } }
  ).exec()
  await CollaboratorsHandler.promises.addUserIdToProject(
    projectId,
    newOwnerId,
    previousOwnerId,
    PrivilegeLevels.READ_AND_WRITE
  )
}

async function _sendEmails(project, previousOwner, newOwner) {
  if (previousOwner == null) {
    // The previous owner didn't exist. This is not supposed to happen, but
    // since we're changing the owner anyway, we'll just warn
    logger.warn(
      { projectId: project._id, ownerId: previousOwner._id },
      'Project owner did not exist before ownership transfer'
    )
  } else {
    // Send confirmation emails
    await Promise.all([
      EmailHandler.promises.sendEmail(
        'ownershipTransferConfirmationPreviousOwner',
        {
          to: previousOwner.email,
          project,
          newOwner
        }
      ),
      EmailHandler.promises.sendEmail('ownershipTransferConfirmationNewOwner', {
        to: newOwner.email,
        project,
        previousOwner
      })
    ])
  }
}
