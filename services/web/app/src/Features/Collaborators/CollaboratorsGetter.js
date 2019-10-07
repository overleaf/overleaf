const { callbackify } = require('util')
const pLimit = require('p-limit')
const { ObjectId } = require('mongojs')
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
  getInvitedCollaboratorCount: callbackify(getInvitedCollaboratorCount),
  getProjectsUserIsMemberOf: callbackify(getProjectsUserIsMemberOf),
  isUserInvitedMemberOfProject: callbackify(isUserInvitedMemberOfProject),
  userIsTokenMember: callbackify(userIsTokenMember),
  getAllInvitedMembers: callbackify(getAllInvitedMembers),
  promises: {
    getMemberIdsWithPrivilegeLevels,
    getMemberIds,
    getInvitedMemberIds,
    getInvitedMembersWithPrivilegeLevels,
    getInvitedMembersWithPrivilegeLevelsFromFields,
    getMemberIdPrivilegeLevel,
    getInvitedCollaboratorCount,
    getProjectsUserIsMemberOf,
    isUserInvitedMemberOfProject,
    userIsTokenMember,
    getAllInvitedMembers
  }
}

async function getMemberIdsWithPrivilegeLevels(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    collaberator_refs: 1,
    readOnly_refs: 1,
    tokenAccessReadOnly_refs: 1,
    tokenAccessReadAndWrite_refs: 1,
    publicAccesLevel: 1
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
    project.publicAccesLevel
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
  let members = _getMemberIdsWithPrivilegeLevelsFromFields(
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

async function getInvitedCollaboratorCount(projectId) {
  const count = await _getInvitedMemberCount(projectId)
  return count - 1 // Don't count project owner
}

async function isUserInvitedMemberOfProject(userId, projectId) {
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

async function getProjectsUserIsMemberOf(userId, fields) {
  const limit = pLimit(2)
  const [
    readAndWrite,
    readOnly,
    tokenReadAndWrite,
    tokenReadOnly
  ] = await Promise.all([
    limit(() => Project.find({ collaberator_refs: userId }, fields).exec()),
    limit(() => Project.find({ readOnly_refs: userId }, fields).exec()),
    limit(() =>
      Project.find(
        {
          tokenAccessReadAndWrite_refs: userId,
          publicAccesLevel: PublicAccessLevels.TOKEN_BASED
        },
        fields
      ).exec()
    ),
    limit(() =>
      Project.find(
        {
          tokenAccessReadOnly_refs: userId,
          publicAccesLevel: PublicAccessLevels.TOKEN_BASED
        },
        fields
      ).exec()
    )
  ])
  return { readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly }
}

async function getAllInvitedMembers(projectId) {
  try {
    const rawMembers = await getInvitedMembersWithPrivilegeLevels(projectId)
    const { members } = ProjectEditorHandler.buildOwnerAndMembersViews(
      rawMembers
    )
    return members
  } catch (err) {
    throw new OError({
      message: 'error getting members for project',
      info: { projectId }
    }).withCause(err)
  }
}

async function userIsTokenMember(userId, projectId) {
  userId = ObjectId(userId.toString())
  projectId = ObjectId(projectId.toString())
  const project = await Project.findOne(
    {
      _id: projectId,
      $or: [
        { tokenAccessReadOnly_refs: userId },
        { tokenAccessReadAndWrite_refs: userId }
      ]
    },
    {
      _id: 1
    }
  ).exec()
  return project != null
}

async function _getInvitedMemberCount(projectId) {
  const members = await getMemberIdsWithPrivilegeLevels(projectId)
  return members.filter(m => m.source !== Sources.TOKEN).length
}

function _getMemberIdsWithPrivilegeLevelsFromFields(
  ownerId,
  collaboratorIds,
  readOnlyIds,
  tokenAccessIds,
  tokenAccessReadOnlyIds,
  publicAccessLevel
) {
  const members = []
  members.push({
    id: ownerId.toString(),
    privilegeLevel: PrivilegeLevels.OWNER,
    source: Sources.OWNER
  })
  for (const memberId of collaboratorIds || []) {
    members.push({
      id: memberId.toString(),
      privilegeLevel: PrivilegeLevels.READ_AND_WRITE,
      source: Sources.INVITE
    })
  }
  for (const memberId of readOnlyIds || []) {
    members.push({
      id: memberId.toString(),
      privilegeLevel: PrivilegeLevels.READ_ONLY,
      source: Sources.INVITE
    })
  }
  if (publicAccessLevel === PublicAccessLevels.TOKEN_BASED) {
    for (const memberId of tokenAccessIds || []) {
      members.push({
        id: memberId.toString(),
        privilegeLevel: PrivilegeLevels.READ_AND_WRITE,
        source: Sources.TOKEN
      })
    }
    for (const memberId of tokenAccessReadOnlyIds || []) {
      members.push({
        id: memberId.toString(),
        privilegeLevel: PrivilegeLevels.READ_ONLY,
        source: Sources.TOKEN
      })
    }
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
          signUpDate: 1
        })
        if (user != null) {
          return { user, privilegeLevel: member.privilegeLevel }
        } else {
          return null
        }
      })
    )
  )
  return results.filter(r => r != null)
}
