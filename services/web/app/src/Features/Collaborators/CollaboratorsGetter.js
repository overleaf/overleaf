const { callbackify } = require('util')
const pLimit = require('p-limit')
const { ObjectId } = require('mongodb-legacy')
const OError = require('@overleaf/o-error')
const { Project } = require('../../models/Project')
const UserGetter = require('../User/UserGetter')
const ProjectGetter = require('../Project/ProjectGetter')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')
const Errors = require('../Errors/Errors')
const ProjectEditorHandler = require('../Project/ProjectEditorHandler')
const Sources = require('../Authorization/Sources')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')

module.exports = {
  getMemberIdsWithPrivilegeLevels: callbackify(getMemberIdsWithPrivilegeLevels),
  getMemberIds: callbackify(getMemberIds),
  getInvitedMemberIds: callbackify(getInvitedMemberIds),
  getInvitedMembersWithPrivilegeLevels: callbackify(
    getInvitedMembersWithPrivilegeLevels
  ),
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
    getMemberIdsWithPrivilegeLevels,
    getMemberIds,
    getInvitedMemberIds,
    getInvitedMembersWithPrivilegeLevels,
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
}

async function getMemberIdsWithPrivilegeLevels(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    collaberator_refs: 1,
    readOnly_refs: 1,
    tokenAccessReadOnly_refs: 1,
    tokenAccessReadAndWrite_refs: 1,
    publicAccesLevel: 1,
    pendingEditor_refs: 1,
    reviewer_refs: 1,
  })
  if (!project) {
    throw new Errors.NotFoundError(`no project found with id ${projectId}`)
  }
  const memberIds = _getMemberIdsWithPrivilegeLevelsFromFields(
    project.owner_ref,
    project.collaberator_refs,
    project.readOnly_refs,
    project.tokenAccessReadAndWrite_refs,
    project.tokenAccessReadOnly_refs,
    project.publicAccesLevel,
    project.pendingEditor_refs,
    project.reviewer_refs
  )
  return memberIds
}

async function getMemberIds(projectId) {
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  return members.map(m => m.id)
}

async function getInvitedMemberIds(projectId) {
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  return members.filter(m => m.source !== Sources.TOKEN).map(m => m.id)
}

async function getInvitedMembersWithPrivilegeLevels(projectId) {
  let members = await getMemberIdsWithPrivilegeLevels(projectId)
  members = members.filter(m => m.source !== Sources.TOKEN)
  return _loadMembers(members)
}

async function getInvitedMembersWithPrivilegeLevelsFromFields(
  ownerId,
  collaboratorIds,
  readOnlyIds
) {
  const members = _getMemberIdsWithPrivilegeLevelsFromFields(
    ownerId,
    collaboratorIds,
    readOnlyIds,
    [],
    [],
    null
  )
  return _loadMembers(members)
}

async function getMemberIdPrivilegeLevel(userId, projectId) {
  // In future if the schema changes and getting all member ids is more expensive (multiple documents)
  // then optimise this.
  if (userId == null) {
    return PrivilegeLevels.NONE
  }
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  for (const member of members) {
    if (member.id === userId.toString()) {
      return member.privilegeLevel
    }
  }
  return PrivilegeLevels.NONE
}

async function getInvitedEditCollaboratorCount(projectId) {
  // Only counts invited members with readAndWrite privilege
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  return members.filter(
    m =>
      m.source === Sources.INVITE &&
      m.privilegeLevel === PrivilegeLevels.READ_AND_WRITE
  ).length
}

async function getInvitedPendingEditorCount(projectId) {
  // Only counts invited members that are readonly pending editors
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  return members.filter(
    m =>
      m.source === Sources.INVITE &&
      m.privilegeLevel === PrivilegeLevels.READ_ONLY &&
      m.pendingEditor === true
  ).length
}

async function isUserInvitedMemberOfProject(userId, projectId) {
  if (!userId) {
    return false
  }
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  for (const member of members) {
    if (
      member.id.toString() === userId.toString() &&
      member.source !== Sources.TOKEN
    ) {
      return true
    }
  }
  return false
}

async function isUserInvitedReadWriteMemberOfProject(userId, projectId) {
  if (!userId) {
    return false
  }
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  for (const member of members) {
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

  if (memberInfo.isOwner) {
    return memberInfo.tokens
  } else if (memberInfo.hasTokenReadOnlyAccess) {
    return {
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
    const rawMembers = await getInvitedMembersWithPrivilegeLevels(projectId)
    const { members } =
      ProjectEditorHandler.buildOwnerAndMembersViews(rawMembers)
    return members
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

function _getMemberIdsWithPrivilegeLevelsFromFields(
  ownerId,
  collaboratorIds,
  readOnlyIds,
  tokenAccessIds,
  tokenAccessReadOnlyIds,
  publicAccessLevel,
  pendingEditorIds,
  reviewerIds
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
  for (const memberId of readOnlyIds || []) {
    members.push({
      id: memberId.toString(),
      privilegeLevel: PrivilegeLevels.READ_ONLY,
      source: Sources.INVITE,
      ...(pendingEditorIds?.some(pe => memberId.equals(pe)) && {
        pendingEditor: true,
      }),
    })
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
  for (const memberId of reviewerIds || []) {
    members.push({
      id: memberId.toString(),
      privilegeLevel: PrivilegeLevels.REVIEW,
      source: Sources.INVITE,
    })
  }
  return members
}

async function _loadMembers(members) {
  const limit = pLimit(3)
  const results = await Promise.all(
    members.map(member =>
      limit(async () => {
        const user = await UserGetter.promises.getUser(member.id, {
          _id: 1,
          email: 1,
          features: 1,
          first_name: 1,
          last_name: 1,
          signUpDate: 1,
        })
        if (user != null) {
          return {
            user,
            privilegeLevel: member.privilegeLevel,
            ...(member.pendingEditor && { pendingEditor: true }),
          }
        } else {
          return null
        }
      })
    )
  )
  return results.filter(r => r != null)
}
