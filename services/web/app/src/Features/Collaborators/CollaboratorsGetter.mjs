// @ts-check
import { callbackify } from 'node:util'

import pLimit from 'p-limit'
import mongodb from 'mongodb-legacy'
import OError from '@overleaf/o-error'
import { Project } from '../../models/Project.mjs'
import UserGetter from '../User/UserGetter.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import PublicAccessLevels from '../Authorization/PublicAccessLevels.mjs'
import Errors from '../Errors/Errors.js'
import ProjectEditorHandler from '../Project/ProjectEditorHandler.mjs'
import Sources from '../Authorization/Sources.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'

const { ObjectId } = mongodb

/** @import {ObjectId} from "mongodb-legacy" */

/** @import { PrivilegeLevel, Source, PublicAccessLevel } from "../Authorization/types" */

/**
 * @typedef ProjectMember
 * @property {string} id
 * @property {PrivilegeLevel} privilegeLevel
 * @property {Source} source
 * @property {boolean} [pendingEditor]
 * @property {boolean} [pendingReviewer]
 */

/**
 * @typedef LoadedProjectMember
 * @property {PrivilegeLevel} privilegeLevel
 * @property {{_id: ObjectId, email: string, features: any, first_name: string, last_name: string, signUpDate: Date}} user
 * @property {boolean} [pendingEditor]
 * @property {boolean} [pendingReviewer]
 */

// Wrapper for determining multiple dimensions of project access.
class ProjectAccess {
  /** @type {ProjectMember[]} */
  #members

  /** @type {PublicAccessLevel} */
  #publicAccessLevel

  /**
   * @param {{ owner_ref: ObjectId; collaberator_refs: ObjectId[]; readOnly_refs: ObjectId[]; tokenAccessReadAndWrite_refs: ObjectId[]; tokenAccessReadOnly_refs: ObjectId[]; publicAccesLevel: PublicAccessLevel; pendingEditor_refs: ObjectId[]; reviewer_refs: ObjectId[]; pendingReviewer_refs: ObjectId[]; }} project
   */
  constructor(project) {
    this.#members = _getMemberIdsWithPrivilegeLevelsFromFields(
      project.owner_ref,
      project.collaberator_refs,
      project.readOnly_refs,
      project.tokenAccessReadAndWrite_refs,
      project.tokenAccessReadOnly_refs,
      project.publicAccesLevel,
      project.pendingEditor_refs,
      project.reviewer_refs,
      project.pendingReviewer_refs
    )
    this.#publicAccessLevel = project.publicAccesLevel
  }

  /**
   * @return {Promise<{ownerMember: LoadedProjectMember|undefined, members: LoadedProjectMember[]}>}
   */
  async loadOwnerAndInvitedMembers() {
    const all = await _loadMembers(
      this.#members.filter(m => m.source !== Sources.TOKEN)
    )
    return {
      ownerMember: all.find(m => m.privilegeLevel === PrivilegeLevels.OWNER),
      members: all.filter(m => m.privilegeLevel !== PrivilegeLevels.OWNER),
    }
  }

  /**
   * @return {Promise<LoadedProjectMember[]>}
   */
  async loadInvitedMembers() {
    return _loadMembers(
      this.#members.filter(
        m =>
          m.source !== Sources.TOKEN &&
          m.privilegeLevel !== PrivilegeLevels.OWNER
      )
    )
  }

  /**
   * @return {Promise<LoadedProjectMember|undefined>}
   */
  async loadOwner() {
    const [owner] = await _loadMembers(
      this.#members.filter(m => m.privilegeLevel === PrivilegeLevels.OWNER)
    )
    return owner
  }

  /**
   * @return {ProjectMember[]}
   */
  allMembers() {
    return this.#members
  }

  /**
   * @return {PublicAccessLevel}
   */
  publicAccessLevel() {
    return this.#publicAccessLevel
  }

  /**
   * @return {string[]}
   */
  memberIds() {
    return this.#members.map(m => m.id)
  }

  /**
   * @return {string[]}
   */
  invitedMemberIds() {
    return this.#members.filter(m => m.source !== Sources.TOKEN).map(m => m.id)
  }

  /**
   * @param {string | ObjectId} userId
   * @return {PrivilegeLevel}
   */
  privilegeLevelForUser(userId) {
    if (!userId) return PrivilegeLevels.NONE
    for (const member of this.#members) {
      if (member.id === userId.toString()) {
        return member.privilegeLevel
      }
    }
    return PrivilegeLevels.NONE
  }

  /**
   * @param {string | ObjectId} userId
   * @return {boolean}
   */
  isUserTokenMember(userId) {
    if (!userId) return false
    for (const member of this.#members) {
      if (member.id === userId.toString() && member.source === Sources.TOKEN) {
        return true
      }
    }
    return false
  }

  /**
   * @param {string | ObjectId} userId
   * @return {boolean}
   */
  isUserInvitedMember(userId) {
    if (!userId) return false
    for (const member of this.#members) {
      if (member.id === userId.toString() && member.source !== Sources.TOKEN) {
        return true
      }
    }
    return false
  }

  /**
   * @param {string | ObjectId} userId
   * @return {boolean}
   */
  isUserInvitedReadWriteMember(userId) {
    for (const member of this.#members) {
      if (
        member.id.toString() === userId.toString() &&
        member.source !== Sources.TOKEN &&
        member.privilegeLevel === PrivilegeLevels.READ_AND_WRITE
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Counts invited members with editor or reviewer roles
   * @return {number}
   */
  countInvitedEditCollaborators() {
    return this.#members.filter(
      m =>
        m.source === Sources.INVITE &&
        (m.privilegeLevel === PrivilegeLevels.READ_AND_WRITE ||
          m.privilegeLevel === PrivilegeLevels.REVIEW)
    ).length
  }

  /**
   * Counts invited members that are readonly pending editors or pending reviewers
   * @return {number}
   */
  countInvitedPendingEditors() {
    return this.#members.filter(
      m =>
        m.source === Sources.INVITE &&
        m.privilegeLevel === PrivilegeLevels.READ_ONLY &&
        (m.pendingEditor || m.pendingReviewer)
    ).length
  }
}

async function getProjectAccess(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    collaberator_refs: 1,
    readOnly_refs: 1,
    tokenAccessReadOnly_refs: 1,
    tokenAccessReadAndWrite_refs: 1,
    publicAccesLevel: 1,
    pendingEditor_refs: 1,
    reviewer_refs: 1,
    pendingReviewer_refs: 1,
  })
  if (!project) {
    throw new Errors.NotFoundError(`no project found with id ${projectId}`)
  }
  return new ProjectAccess(project)
}

async function getMemberIdsWithPrivilegeLevels(projectId) {
  return (await getProjectAccess(projectId)).allMembers()
}

async function getMemberIds(projectId) {
  return (await getProjectAccess(projectId)).memberIds()
}

async function getInvitedMemberIds(projectId) {
  return (await getProjectAccess(projectId)).invitedMemberIds()
}

async function getInvitedMembersWithPrivilegeLevelsFromFields(
  ownerId,
  collaboratorIds,
  readOnlyIds,
  reviewerIds
) {
  const members = _getMemberIdsWithPrivilegeLevelsFromFields(
    ownerId,
    collaboratorIds,
    readOnlyIds,
    [],
    [],
    'private',
    [],
    reviewerIds,
    []
  )
  return _loadMembers(members)
}

async function getMemberIdPrivilegeLevel(userId, projectId) {
  // In future if the schema changes and getting all member ids is more expensive (multiple documents)
  // then optimise this.
  if (userId == null) {
    return PrivilegeLevels.NONE
  }
  return (await getProjectAccess(projectId)).privilegeLevelForUser(userId)
}

async function getInvitedEditCollaboratorCount(projectId) {
  return (await getProjectAccess(projectId)).countInvitedEditCollaborators()
}

async function getInvitedPendingEditorCount(projectId) {
  return (await getProjectAccess(projectId)).countInvitedPendingEditors()
}

async function isUserInvitedMemberOfProject(userId, projectId) {
  if (!userId) {
    return false
  }
  return (await getProjectAccess(projectId)).isUserInvitedMember(userId)
}

async function isUserInvitedReadWriteMemberOfProject(userId, projectId) {
  if (!userId) {
    return false
  }
  return (await getProjectAccess(projectId)).isUserInvitedReadWriteMember(
    userId
  )
}

async function getPublicShareTokens(userId, projectId) {
  const memberInfo = await Project.findOne(
    {
      _id: projectId,
    },
    {
      isOwner: { $eq: ['$owner_ref', userId] },
      hasTokenReadOnlyAccess: {
        $and: [
          { $in: [userId, '$tokenAccessReadOnly_refs'] },
          { $eq: ['$publicAccesLevel', PublicAccessLevels.TOKEN_BASED] },
        ],
      },
      tokens: 1,
    }
  )
    .lean()
    .exec()

  if (!memberInfo) {
    return null
  }

  // @ts-ignore
  if (memberInfo.isOwner) {
    return memberInfo.tokens
    // @ts-ignore
  } else if (memberInfo.hasTokenReadOnlyAccess) {
    return {
      // @ts-ignore
      readOnly: memberInfo.tokens.readOnly,
    }
  } else {
    return {}
  }
}

// This function returns all the projects that a user currently has access to,
// excluding projects where the user is listed in the token access fields when
// token access has been disabled.
async function getProjectsUserIsMemberOf(userId, fields) {
  // @ts-ignore
  const limit = pLimit(2)
  const [readAndWrite, review, readOnly, tokenReadAndWrite, tokenReadOnly] =
    await Promise.all([
      limit(() => Project.find({ collaberator_refs: userId }, fields).exec()),
      limit(() => Project.find({ reviewer_refs: userId }, fields).exec()),
      limit(() => Project.find({ readOnly_refs: userId }, fields).exec()),
      limit(() =>
        Project.find(
          {
            tokenAccessReadAndWrite_refs: userId,
            publicAccesLevel: PublicAccessLevels.TOKEN_BASED,
          },
          fields
        ).exec()
      ),
      limit(() =>
        Project.find(
          {
            tokenAccessReadOnly_refs: userId,
            publicAccesLevel: PublicAccessLevels.TOKEN_BASED,
          },
          fields
        ).exec()
      ),
    ])
  return { readAndWrite, review, readOnly, tokenReadAndWrite, tokenReadOnly }
}

// This function returns all the projects that a user is a member of, regardless of
// the current state of the project, so it includes those projects where token access
// has been disabled.
async function dangerouslyGetAllProjectsUserIsMemberOf(userId, fields) {
  const readAndWrite = await Project.find(
    { collaberator_refs: userId },
    fields
  ).exec()
  const readOnly = await Project.find({ readOnly_refs: userId }, fields).exec()
  const tokenReadAndWrite = await Project.find(
    { tokenAccessReadAndWrite_refs: userId },
    fields
  ).exec()
  const tokenReadOnly = await Project.find(
    { tokenAccessReadOnly_refs: userId },
    fields
  ).exec()
  return { readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly }
}

async function getAllInvitedMembers(projectId) {
  try {
    const projectAccess = await getProjectAccess(projectId)
    const invitedMembers = await projectAccess.loadInvitedMembers()
    return invitedMembers.map(ProjectEditorHandler.buildUserModelView)
  } catch (err) {
    throw OError.tag(err, 'error getting members for project', { projectId })
  }
}

async function userIsTokenMember(userId, projectId) {
  userId = new ObjectId(userId.toString())
  projectId = new ObjectId(projectId.toString())
  const project = await Project.findOne(
    {
      _id: projectId,
      $or: [
        { tokenAccessReadOnly_refs: userId },
        { tokenAccessReadAndWrite_refs: userId },
      ],
    },
    {
      _id: 1,
    }
  ).exec()
  return project != null
}

async function userIsReadWriteTokenMember(userId, projectId) {
  userId = new ObjectId(userId.toString())
  projectId = new ObjectId(projectId.toString())
  const project = await Project.findOne(
    {
      _id: projectId,
      tokenAccessReadAndWrite_refs: userId,
    },
    {
      _id: 1,
    }
  ).exec()
  return project != null
}

/**
 * @param {ObjectId} ownerId
 * @param {ObjectId[]} collaboratorIds
 * @param {ObjectId[]} readOnlyIds
 * @param {ObjectId[]} tokenAccessIds
 * @param {ObjectId[]} tokenAccessReadOnlyIds
 * @param {PublicAccessLevel} publicAccessLevel
 * @param {ObjectId[]} pendingEditorIds
 * @param {ObjectId[]} reviewerIds
 * @param {ObjectId[]} pendingReviewerIds
 * @return {ProjectMember[]}
 * @private
 */
function _getMemberIdsWithPrivilegeLevelsFromFields(
  ownerId,
  collaboratorIds,
  readOnlyIds,
  tokenAccessIds,
  tokenAccessReadOnlyIds,
  publicAccessLevel,
  pendingEditorIds,
  reviewerIds,
  pendingReviewerIds
) {
  const members = []
  members.push({
    id: ownerId.toString(),
    privilegeLevel: PrivilegeLevels.OWNER,
    source: Sources.OWNER,
  })

  for (const memberId of collaboratorIds || []) {
    members.push({
      id: memberId.toString(),
      privilegeLevel: PrivilegeLevels.READ_AND_WRITE,
      source: Sources.INVITE,
    })
  }

  for (const memberId of reviewerIds || []) {
    members.push({
      id: memberId.toString(),
      privilegeLevel: PrivilegeLevels.REVIEW,
      source: Sources.INVITE,
    })
  }

  for (const memberId of readOnlyIds || []) {
    const record = {
      id: memberId.toString(),
      privilegeLevel: PrivilegeLevels.READ_ONLY,
      source: Sources.INVITE,
    }

    if (pendingEditorIds?.some(pe => memberId.equals(pe))) {
      record.pendingEditor = true
    } else if (pendingReviewerIds?.some(pr => memberId.equals(pr))) {
      record.pendingReviewer = true
    }
    members.push(record)
  }

  if (publicAccessLevel === PublicAccessLevels.TOKEN_BASED) {
    for (const memberId of tokenAccessIds || []) {
      members.push({
        id: memberId.toString(),
        privilegeLevel: PrivilegeLevels.READ_AND_WRITE,
        source: Sources.TOKEN,
      })
    }
    for (const memberId of tokenAccessReadOnlyIds || []) {
      members.push({
        id: memberId.toString(),
        privilegeLevel: PrivilegeLevels.READ_ONLY,
        source: Sources.TOKEN,
      })
    }
  }

  return members
}

/**
 * @param {ProjectMember[]} members
 * @return {Promise<LoadedProjectMember[]>}
 * @private
 */
async function _loadMembers(members) {
  if (members.length === 0) return []
  const userIds = Array.from(new Set(members.map(m => m.id)))
  const users = new Map()
  for (const user of await UserGetter.promises.getUsers(userIds, {
    _id: 1,
    email: 1,
    features: 1,
    first_name: 1,
    last_name: 1,
    signUpDate: 1,
  })) {
    users.set(user._id.toString(), user)
  }
  return members
    .map(member => {
      const user = users.get(member.id)
      if (!user) return null
      const record = {
        user,
        privilegeLevel: member.privilegeLevel,
      }
      if (member.pendingEditor) {
        record.pendingEditor = true
      } else if (member.pendingReviewer) {
        record.pendingReviewer = true
      }
      return record
    })
    .filter(r => r != null)
}

export default {
  getMemberIdsWithPrivilegeLevels: callbackify(getMemberIdsWithPrivilegeLevels),
  getMemberIds: callbackify(getMemberIds),
  getInvitedMemberIds: callbackify(getInvitedMemberIds),
  getInvitedMembersWithPrivilegeLevelsFromFields: callbackify(
    getInvitedMembersWithPrivilegeLevelsFromFields
  ),
  getMemberIdPrivilegeLevel: callbackify(getMemberIdPrivilegeLevel),
  getProjectsUserIsMemberOf: callbackify(getProjectsUserIsMemberOf),
  dangerouslyGetAllProjectsUserIsMemberOf: callbackify(
    dangerouslyGetAllProjectsUserIsMemberOf
  ),
  isUserInvitedMemberOfProject: callbackify(isUserInvitedMemberOfProject),
  getPublicShareTokens: callbackify(getPublicShareTokens),
  userIsTokenMember: callbackify(userIsTokenMember),
  getAllInvitedMembers: callbackify(getAllInvitedMembers),
  promises: {
    getProjectAccess,
    getMemberIdsWithPrivilegeLevels,
    getMemberIds,
    getInvitedMemberIds,
    getInvitedMembersWithPrivilegeLevelsFromFields,
    getMemberIdPrivilegeLevel,
    getInvitedEditCollaboratorCount,
    getInvitedPendingEditorCount,
    getProjectsUserIsMemberOf,
    dangerouslyGetAllProjectsUserIsMemberOf,
    isUserInvitedMemberOfProject,
    isUserInvitedReadWriteMemberOfProject,
    getPublicShareTokens,
    userIsTokenMember,
    userIsReadWriteTokenMember,
    getAllInvitedMembers,
  },
  ProjectAccess,
}
