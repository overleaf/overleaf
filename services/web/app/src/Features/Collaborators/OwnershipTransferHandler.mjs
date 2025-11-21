import logger from '@overleaf/logger'
import { Project } from '../../models/Project.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import UserGetter from '../User/UserGetter.mjs'
import CollaboratorsHandler from './CollaboratorsHandler.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import Errors from '../Errors/Errors.js'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import TpdsProjectFlusher from '../ThirdPartyDataStore/TpdsProjectFlusher.mjs'
import ProjectAuditLogHandler from '../Project/ProjectAuditLogHandler.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import OError from '@overleaf/o-error'
import TagsHandler from '../Tags/TagsHandler.mjs'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import LimitationsManager from '../Subscription/LimitationsManager.mjs'

export default {
  promises: {
    transferOwnership,
    transferAllProjectsToUser,
  },
}

const TAG_COLOR_BLUE = '#434AF0'

/**
 * @param {string} fromUserId
 * @param {string} toUserId
 * @param {string} ipAddress
 * @return {Promise<{projectCount: number, newTagName: string}>}
 */
async function transferAllProjectsToUser({ fromUserId, toUserId, ipAddress }) {
  // - Verify that both users exist
  const fromUser = await UserGetter.promises.getUser(fromUserId, {
    _id: 1,
    email: 1,
  })
  const toUser = await UserGetter.promises.getUser(toUserId, { _id: 1 })
  if (!fromUser) throw new OError('missing source user', { fromUserId })
  if (!toUser) throw new OError('missing destination user', { toUserId })
  if (fromUser._id.equals(toUser._id))
    throw new OError('rejecting transfer between identical users', {
      fromUserId,
      toUserId,
    })
  logger.debug(
    { fromUserId, toUserId },
    'started bulk transfer of all projects from one user to another'
  )
  // - Get all owned projects for fromUserId
  const projects = await Project.find({ owner_ref: fromUserId }, { _id: 1 })

  // - Create new tag on toUserId
  const newTag = await TagsHandler.promises.createTag(
    toUserId,
    `transferred-from-${fromUser.email}`,
    TAG_COLOR_BLUE,
    { truncate: true }
  )

  // - Add tag to projects (can happen before ownership is transferred)
  await TagsHandler.promises.addProjectsToTag(
    toUserId,
    newTag._id,
    projects.map(p => p._id)
  )

  // - Transfer all projects
  await promiseMapWithLimit(5, projects, async project => {
    await transferOwnership(project._id, toUserId, {
      allowTransferToNonCollaborators: true,
      skipEmails: true,
      ipAddress,
    })
  })

  logger.debug(
    { fromUserId, toUserId },
    'finished bulk transfer of all projects from one user to another'
  )
  return { projectCount: projects.length, newTagName: newTag.name }
}

async function transferOwnership(projectId, newOwnerId, options = {}) {
  const {
    allowTransferToNonCollaborators,
    sessionUserId,
    skipEmails,
    ipAddress,
  } = options

  // Fetch project and user
  const [project, newOwner] = await Promise.all([
    _getProject(projectId),
    _getUser(newOwnerId),
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

  // Track the change of ownership in BigQuery.
  AnalyticsManager.recordEventForUserInBackground(
    previousOwnerId,
    'project-ownership-transfer',
    { projectId, newOwnerId }
  )

  // Transfer ownership
  await ProjectAuditLogHandler.promises.addEntry(
    projectId,
    'transfer-ownership',
    sessionUserId,
    ipAddress,
    { previousOwnerId, newOwnerId }
  )

  // Transfer ownership
  await _transferOwnership(projectId, previousOwnerId, newOwnerId)

  // Determine which permissions to give old owner (after transfer, so we use new owner's limits)
  const { privilegeLevel, pendingPrivilegeLevel } =
    await _determinePrivilegeLevelForPreviousOwner(projectId)

  // Add the previous owner back to the project with determined permissions
  await CollaboratorsHandler.promises.addUserIdToProject(
    projectId,
    newOwnerId,
    previousOwnerId,
    privilegeLevel,
    pendingPrivilegeLevel
  )

  // Flush project to TPDS
  await TpdsProjectFlusher.promises.flushProjectToTpds(projectId)

  // Send confirmation emails
  if (!skipEmails) {
    const previousOwner = await UserGetter.promises.getUser(previousOwnerId)
    await _sendEmails(project, previousOwner, newOwner)
  }
}

async function _getProject(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    collaberator_refs: 1,
    readOnly_refs: 1,
    reviewer_refs: 1,
    name: 1,
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

function _getUserPermissions(user, project) {
  const collaboratorIds = project.collaberator_refs || []
  const readOnlyIds = project.readOnly_refs || []
  const reviewerIds = project.reviewer_refs || []
  if (collaboratorIds.some(collaboratorId => collaboratorId.equals(user._id))) {
    return PrivilegeLevels.READ_AND_WRITE
  } else if (
    reviewerIds.some(collaboratorId => collaboratorId.equals(user._id))
  ) {
    return PrivilegeLevels.REVIEW
  } else if (
    readOnlyIds.some(collaboratorId => collaboratorId.equals(user._id))
  ) {
    return PrivilegeLevels.READ_ONLY
  }
}

function _userIsCollaborator(user, project) {
  return Boolean(_getUserPermissions(user, project))
}

async function _determinePrivilegeLevelForPreviousOwner(projectId) {
  // Try to give READ_AND_WRITE if space available based on new owner's limits
  const canAddEditor =
    await LimitationsManager.promises.canAddXEditCollaborators(projectId, 1)

  if (canAddEditor) {
    return { privilegeLevel: PrivilegeLevels.READ_AND_WRITE }
  }

  // Collaborator limit is reached for editor and reviewer so fall back to read-only
  // Add pending editor status so they are automatically upgraded when possible
  return {
    privilegeLevel: PrivilegeLevels.READ_ONLY,
    pendingPrivilegeLevel: { pendingEditor: true },
  }
}

async function _transferOwnership(projectId, previousOwnerId, newOwnerId) {
  // Remove new owner from collaborators list
  await CollaboratorsHandler.promises.removeUserFromProject(
    projectId,
    newOwnerId
  )
  // Update project ownership
  await Project.updateOne(
    { _id: projectId },
    { $set: { owner_ref: newOwnerId } }
  ).exec()
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
          newOwner,
        }
      ),
      EmailHandler.promises.sendEmail('ownershipTransferConfirmationNewOwner', {
        to: newOwner.email,
        project,
        previousOwner,
      }),
    ])
  }
}
