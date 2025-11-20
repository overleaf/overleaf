import { callbackify } from 'node:util'
import mongodb from 'mongodb-legacy'
import Features from '../../infrastructure/Features.mjs'
import CollaboratorsGetter from '../Collaborators/CollaboratorsGetter.mjs'
import CollaboratorsHandler from '../Collaborators/CollaboratorsHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import { User } from '../../models/User.mjs'
import PrivilegeLevels from './PrivilegeLevels.mjs'
import TokenAccessHandler from '../TokenAccess/TokenAccessHandler.mjs'
import PublicAccessLevels from './PublicAccessLevels.mjs'
import Errors from '../Errors/Errors.js'
import AdminAuthorizationHelper from '../Helpers/AdminAuthorizationHelper.mjs'
import Settings from '@overleaf/settings'
import ChatApiHandler from '../Chat/ChatApiHandler.mjs'

const { hasAdminAccess, getAdminCapabilities } = AdminAuthorizationHelper
const { ObjectId } = mongodb

function isRestrictedUser(
  userId,
  privilegeLevel,
  isTokenMember,
  isInvitedMember
) {
  if (privilegeLevel === PrivilegeLevels.NONE) {
    return true
  }
  return (
    privilegeLevel === PrivilegeLevels.READ_ONLY &&
    (isTokenMember || !userId) &&
    !isInvitedMember
  )
}

async function isRestrictedUserForProject(userId, projectId, token) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token
  )
  const isTokenMember = await CollaboratorsHandler.promises.userIsTokenMember(
    userId,
    projectId
  )
  const isInvitedMember =
    await CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
      userId,
      projectId
    )
  return isRestrictedUser(
    userId,
    privilegeLevel,
    isTokenMember,
    isInvitedMember
  )
}

async function getPublicAccessLevel(projectId) {
  if (!ObjectId.isValid(projectId)) {
    throw new Error('invalid project id')
  }

  // Note, the Project property in the DB is `publicAccesLevel`, without the second `s`
  const project = await ProjectGetter.promises.getProject(projectId, {
    publicAccesLevel: 1,
  })
  if (!project) {
    throw new Errors.NotFoundError(`no project found with id ${projectId}`)
  }
  return project.publicAccesLevel
}

/**
 * Get the privilege level that the user has for the project.
 *
 * @param userId - The id of the user that wants to access the project.
 * @param projectId - The id of the project to be accessed.
 * @param {string} token
 * @param {Object} opts
 * @param {boolean} opts.ignoreSiteAdmin - Do not consider whether the user is
 *     a site admin.
 * @param {boolean} opts.ignorePublicAccess - Do not consider the project is
 *     publicly accessible.
 *
 * @returns {string|boolean} The privilege level. One of "owner",
 *     "readAndWrite", "readOnly" or false.
 */
async function getPrivilegeLevelForProject(
  userId,
  projectId,
  token,
  opts = {}
) {
  if (userId) {
    return await getPrivilegeLevelForProjectWithUser(
      userId,
      projectId,
      null,
      opts
    )
  } else {
    return await getPrivilegeLevelForProjectWithoutUser(projectId, token, opts)
  }
}

/**
 * Get the privilege level that the user has for the project.
 *
 * @param userId - The id of the user that wants to access the project.
 * @param projectId - The id of the project to be accessed.
 * @param {string} token
 * @param {ProjectAccess} projectAccess
 * @param {Object} opts
 * @param {boolean} opts.ignoreSiteAdmin - Do not consider whether the user is
 *     a site admin.
 * @param {boolean} opts.ignorePublicAccess - Do not consider the project is
 *     publicly accessible.
 *
 * @returns {string|boolean} The privilege level. One of "owner",
 *     "readAndWrite", "readOnly" or false.
 */
async function getPrivilegeLevelForProjectWithProjectAccess(
  userId,
  projectId,
  token,
  projectAccess,
  opts = {}
) {
  if (userId) {
    return await getPrivilegeLevelForProjectWithUser(
      userId,
      projectId,
      projectAccess,
      opts
    )
  } else {
    return await _getPrivilegeLevelForProjectWithoutUserWithPublicAccessLevel(
      projectId,
      token,
      projectAccess.publicAccessLevel(),
      opts
    )
  }
}

// User is present, get their privilege level from database
async function getPrivilegeLevelForProjectWithUser(
  userId,
  projectId,
  projectAccess,
  opts = {}
) {
  let adminReadOnly = false
  if (!opts.ignoreSiteAdmin && (await isUserSiteAdmin(userId))) {
    if (!Settings.adminRolesEnabled) {
      return PrivilegeLevels.OWNER
    }
    const { adminCapabilities } = await getAdminCapabilities({ _id: userId })
    if (adminCapabilities.includes('modify-project-content')) {
      return PrivilegeLevels.OWNER
    }
    if (adminCapabilities.includes('view-project-content')) {
      adminReadOnly = true
    }
  }

  projectAccess =
    projectAccess ||
    (await CollaboratorsGetter.promises.getProjectAccess(projectId))

  const privilegeLevel = projectAccess.privilegeLevelForUser(userId)
  if (privilegeLevel && privilegeLevel !== PrivilegeLevels.NONE) {
    // The user has direct access
    return privilegeLevel
  }

  if (!opts.ignorePublicAccess) {
    // Legacy public-access system
    // User is present (not anonymous), but does not have direct access
    const publicAccessLevel = projectAccess.publicAccessLevel()
    if (publicAccessLevel === PublicAccessLevels.READ_ONLY) {
      return PrivilegeLevels.READ_ONLY
    }
    if (publicAccessLevel === PublicAccessLevels.READ_AND_WRITE) {
      return PrivilegeLevels.READ_AND_WRITE
    }
  }

  if (adminReadOnly) {
    return PrivilegeLevels.READ_ONLY
  }

  return PrivilegeLevels.NONE
}

// User is Anonymous, Try Token-based access
async function getPrivilegeLevelForProjectWithoutUser(
  projectId,
  token,
  opts = {}
) {
  return await _getPrivilegeLevelForProjectWithoutUserWithPublicAccessLevel(
    projectId,
    token,
    await getPublicAccessLevel(projectId),
    opts
  )
}

// User is Anonymous, Try Token-based access
async function _getPrivilegeLevelForProjectWithoutUserWithPublicAccessLevel(
  projectId,
  token,
  publicAccessLevel,
  opts = {}
) {
  if (!Features.hasFeature('link-sharing')) {
    // Link sharing disabled globally.
    return PrivilegeLevels.NONE
  }
  if (!opts.ignorePublicAccess) {
    if (publicAccessLevel === PublicAccessLevels.READ_ONLY) {
      // Legacy public read-only access for anonymous user
      return PrivilegeLevels.READ_ONLY
    }
    if (publicAccessLevel === PublicAccessLevels.READ_AND_WRITE) {
      // Legacy public read-write access for anonymous user
      return PrivilegeLevels.READ_AND_WRITE
    }
  }
  if (publicAccessLevel === PublicAccessLevels.TOKEN_BASED) {
    return await getPrivilegeLevelForProjectWithToken(projectId, token)
  }

  // Deny anonymous user access
  return PrivilegeLevels.NONE
}

async function getPrivilegeLevelForProjectWithToken(projectId, token) {
  // Anonymous users can have read-only access to token-based projects,
  // while read-write access must be logged in,
  // unless the `enableAnonymousReadAndWriteSharing` setting is enabled
  const { isValidReadAndWrite, isValidReadOnly } =
    await TokenAccessHandler.promises.validateTokenForAnonymousAccess(
      projectId,
      token
    )
  if (isValidReadOnly) {
    // Grant anonymous user read-only access
    return PrivilegeLevels.READ_ONLY
  }
  if (isValidReadAndWrite) {
    // Grant anonymous user read-and-write access
    return PrivilegeLevels.READ_AND_WRITE
  }
  // Deny anonymous access
  return PrivilegeLevels.NONE
}

async function canUserReadProject(userId, projectId, token) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token,
    { ignoreSiteAdmin: true }
  )
  return (
    [
      PrivilegeLevels.OWNER,
      PrivilegeLevels.READ_AND_WRITE,
      PrivilegeLevels.READ_ONLY,
      PrivilegeLevels.REVIEW,
    ].includes(privilegeLevel) ||
    (await hasAdminProjectCapability(userId, 'view-project-content'))
  )
}

async function canUserWriteProjectContent(userId, projectId, token) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token,
    { ignoreSiteAdmin: true }
  )
  return (
    [PrivilegeLevels.OWNER, PrivilegeLevels.READ_AND_WRITE].includes(
      privilegeLevel
    ) || (await hasAdminProjectCapability(userId, 'modify-project-content'))
  )
}

async function canUserWriteOrReviewProjectContent(userId, projectId, token) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token,
    { ignoreSiteAdmin: true }
  )
  return (
    privilegeLevel === PrivilegeLevels.OWNER ||
    privilegeLevel === PrivilegeLevels.READ_AND_WRITE ||
    privilegeLevel === PrivilegeLevels.REVIEW ||
    (await hasAdminProjectCapability(userId, 'modify-project-content'))
  )
}

async function canUserWriteProjectSettings(userId, projectId, token) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token,
    { ignorePublicAccess: true, ignoreSiteAdmin: true }
  )
  return (
    [PrivilegeLevels.OWNER, PrivilegeLevels.READ_AND_WRITE].includes(
      privilegeLevel
    ) || (await hasAdminProjectCapability(userId, 'modify-project-setting'))
  )
}

async function canUserRenameProject(userId, projectId, token) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token,
    { ignoreSiteAdmin: true }
  )
  return (
    privilegeLevel === PrivilegeLevels.OWNER ||
    (await hasAdminProjectCapability(userId, 'modify-project-setting'))
  )
}

async function canUserAdminProject(userId, projectId, token) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token,
    { ignoreSiteAdmin: true }
  )
  return (
    privilegeLevel === PrivilegeLevels.OWNER ||
    (await hasAdminProjectCapability(userId, 'modify-project-setting'))
  )
}

async function isUserSiteAdmin(userId) {
  if (!userId) {
    return false
  }
  if (!Settings.adminPrivilegeAvailable) return false
  const user = await User.findOne({ _id: userId }, { isAdmin: 1 }).exec()
  return hasAdminAccess(user)
}

/**
 * @param {string} userId
 * @param {'view-project-setting'|'view-project-content'|'modify-project-setting'|'modify-project-content'} adminCapability
 */
async function hasAdminProjectCapability(userId, adminCapability) {
  if (!Settings.adminPrivilegeAvailable || !(await isUserSiteAdmin(userId))) {
    return false
  }
  if (!Settings.adminRolesEnabled) {
    return true
  }
  const { adminCapabilities } = await getAdminCapabilities({ _id: userId })
  return adminCapabilities.includes(adminCapability)
}

async function canUserDeleteOrResolveThread(
  userId,
  projectId,
  threadId,
  token
) {
  const privilegeLevel = await getPrivilegeLevelForProject(
    userId,
    projectId,
    token,
    { ignorePublicAccess: true }
  )
  if (
    privilegeLevel === PrivilegeLevels.OWNER ||
    privilegeLevel === PrivilegeLevels.READ_AND_WRITE
  ) {
    return true
  }

  if (privilegeLevel !== PrivilegeLevels.REVIEW) {
    return false
  }

  try {
    const thread = await ChatApiHandler.promises.getThread(projectId, threadId)
    // Check if the user created the thread (first message)
    return thread.messages.length > 0 && thread.messages[0].user_id === userId
  } catch (error) {
    // If thread doesn't exist or other error, deny access
    return false
  }
}

export default {
  canUserReadProject: callbackify(canUserReadProject),
  canUserWriteProjectContent: callbackify(canUserWriteProjectContent),
  canUserWriteOrReviewProjectContent: callbackify(
    canUserWriteOrReviewProjectContent
  ),
  canUserDeleteOrResolveThread: callbackify(canUserDeleteOrResolveThread),
  canUserWriteProjectSettings: callbackify(canUserWriteProjectSettings),
  canUserRenameProject: callbackify(canUserRenameProject),
  canUserAdminProject: callbackify(canUserAdminProject),
  getPrivilegeLevelForProject: callbackify(getPrivilegeLevelForProject),
  isRestrictedUser,
  isRestrictedUserForProject: callbackify(isRestrictedUserForProject),
  isUserSiteAdmin: callbackify(isUserSiteAdmin),
  promises: {
    canUserReadProject,
    canUserWriteProjectContent,
    canUserWriteOrReviewProjectContent,
    canUserDeleteOrResolveThread,
    canUserWriteProjectSettings,
    canUserRenameProject,
    canUserAdminProject,
    getPrivilegeLevelForProject,
    getPrivilegeLevelForProjectWithProjectAccess,
    isRestrictedUserForProject,
    isUserSiteAdmin,
  },
}
