const { callbackify } = require('util')
const OError = require('@overleaf/o-error')
const { Project } = require('../../models/Project')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectHelper = require('../Project/ProjectHelper')
const logger = require('logger-sharelatex')
const ContactManager = require('../Contacts/ContactManager')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const TpdsProjectFlusher = require('../ThirdPartyDataStore/TpdsProjectFlusher')
const CollaboratorsGetter = require('./CollaboratorsGetter')
const Errors = require('../Errors/Errors')

module.exports = {
  userIsTokenMember: callbackify(userIsTokenMember),
  removeUserFromProject: callbackify(removeUserFromProject),
  removeUserFromAllProjects: callbackify(removeUserFromAllProjects),
  addUserIdToProject: callbackify(addUserIdToProject),
  transferProjects: callbackify(transferProjects),
  promises: {
    userIsTokenMember,
    removeUserFromProject,
    removeUserFromAllProjects,
    addUserIdToProject,
    transferProjects,
    setCollaboratorPrivilegeLevel
  }
}

async function removeUserFromProject(projectId, userId) {
  try {
    const project = await Project.findOne({ _id: projectId }).exec()

    // Deal with the old type of boolean value for archived
    // In order to clear it
    if (typeof project.archived === 'boolean') {
      let archived = ProjectHelper.calculateArchivedArray(
        project,
        userId,
        'ARCHIVE'
      )

      archived = archived.filter(id => id.toString() !== userId.toString())

      await Project.update(
        { _id: projectId },
        {
          $set: { archived: archived },
          $pull: {
            collaberator_refs: userId,
            readOnly_refs: userId,
            tokenAccessReadOnly_refs: userId,
            tokenAccessReadAndWrite_refs: userId,
            trashed: userId
          }
        }
      )
    } else {
      await Project.update(
        { _id: projectId },
        {
          $pull: {
            collaberator_refs: userId,
            readOnly_refs: userId,
            tokenAccessReadOnly_refs: userId,
            tokenAccessReadAndWrite_refs: userId,
            archived: userId,
            trashed: userId
          }
        }
      )
    }
  } catch (err) {
    throw new OError({
      message: 'problem removing user from project collaborators',
      info: { projectId, userId }
    }).withCause(err)
  }
}

async function removeUserFromAllProjects(userId) {
  const {
    readAndWrite,
    readOnly,
    tokenReadAndWrite,
    tokenReadOnly
  } = await CollaboratorsGetter.promises.getProjectsUserIsMemberOf(userId, {
    _id: 1
  })
  const allProjects = readAndWrite
    .concat(readOnly)
    .concat(tokenReadAndWrite)
    .concat(tokenReadOnly)
  for (const project of allProjects) {
    await removeUserFromProject(project._id, userId)
  }
}

async function addUserIdToProject(
  projectId,
  addingUserId,
  userId,
  privilegeLevel
) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    collaberator_refs: 1,
    readOnly_refs: 1
  })
  let level
  let existingUsers = project.collaberator_refs || []
  existingUsers = existingUsers.concat(project.readOnly_refs || [])
  existingUsers = existingUsers.map(u => u.toString())
  if (existingUsers.includes(userId.toString())) {
    return // User already in Project
  }
  if (privilegeLevel === PrivilegeLevels.READ_AND_WRITE) {
    level = { collaberator_refs: userId }
    logger.log({ privileges: 'readAndWrite', userId, projectId }, 'adding user')
  } else if (privilegeLevel === PrivilegeLevels.READ_ONLY) {
    level = { readOnly_refs: userId }
    logger.log({ privileges: 'readOnly', userId, projectId }, 'adding user')
  } else {
    throw new Error(`unknown privilegeLevel: ${privilegeLevel}`)
  }

  if (addingUserId) {
    ContactManager.addContact(addingUserId, userId)
  }

  await Project.update({ _id: projectId }, { $addToSet: level }).exec()

  // Flush to TPDS in background to add files to collaborator's Dropbox
  TpdsProjectFlusher.promises.flushProjectToTpds(projectId).catch(err => {
    logger.error(
      { err, projectId, userId },
      'error flushing to TPDS after adding collaborator'
    )
  })
}

async function transferProjects(fromUserId, toUserId) {
  // Find all the projects this user is part of so we can flush them to TPDS
  const projects = await Project.find(
    {
      $or: [
        { owner_ref: fromUserId },
        { collaberator_refs: fromUserId },
        { readOnly_refs: fromUserId }
      ]
    },
    { _id: 1 }
  ).exec()
  const projectIds = projects.map(p => p._id)
  logger.log({ projectIds, fromUserId, toUserId }, 'transferring projects')

  await Project.update(
    { owner_ref: fromUserId },
    { $set: { owner_ref: toUserId } },
    { multi: true }
  ).exec()

  await Project.update(
    { collaberator_refs: fromUserId },
    {
      $addToSet: { collaberator_refs: toUserId }
    },
    { multi: true }
  ).exec()
  await Project.update(
    { collaberator_refs: fromUserId },
    {
      $pull: { collaberator_refs: fromUserId }
    },
    { multi: true }
  ).exec()

  await Project.update(
    { readOnly_refs: fromUserId },
    {
      $addToSet: { readOnly_refs: toUserId }
    },
    { multi: true }
  ).exec()
  await Project.update(
    { readOnly_refs: fromUserId },
    {
      $pull: { readOnly_refs: fromUserId }
    },
    { multi: true }
  ).exec()

  // Flush in background, no need to block on this
  _flushProjects(projectIds).catch(err => {
    logger.err(
      { err, projectIds, fromUserId, toUserId },
      'error flushing tranferred projects to TPDS'
    )
  })
}

async function setCollaboratorPrivilegeLevel(
  projectId,
  userId,
  privilegeLevel
) {
  // Make sure we're only updating the project if the user is already a
  // collaborator
  const query = {
    _id: projectId,
    $or: [{ collaberator_refs: userId }, { readOnly_refs: userId }]
  }
  let update
  switch (privilegeLevel) {
    case PrivilegeLevels.READ_AND_WRITE: {
      update = {
        $pull: { readOnly_refs: userId },
        $addToSet: { collaberator_refs: userId }
      }
      break
    }
    case PrivilegeLevels.READ_ONLY: {
      update = {
        $pull: { collaberator_refs: userId },
        $addToSet: { readOnly_refs: userId }
      }
      break
    }
    default: {
      throw new OError({
        message: `unknown privilege level: ${privilegeLevel}`
      })
    }
  }
  const mongoResponse = await Project.updateOne(query, update).exec()
  if (mongoResponse.n === 0) {
    throw new Errors.NotFoundError('project or collaborator not found')
  }
}

async function userIsTokenMember(userId, projectId) {
  if (!userId) {
    return false
  }
  try {
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
    )
    return project != null
  } catch (err) {
    throw new OError({
      message: 'problem while checking if user is token member',
      info: { userId, projectId }
    }).withCause(err)
  }
}

async function _flushProjects(projectIds) {
  for (const projectId of projectIds) {
    await TpdsProjectFlusher.promises.flushProjectToTpds(projectId)
  }
}
