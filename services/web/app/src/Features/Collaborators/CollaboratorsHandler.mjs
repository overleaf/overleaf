import { callbackify } from 'node:util'
import OError from '@overleaf/o-error'
import { Project } from '../../models/Project.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import logger from '@overleaf/logger'
import ContactManager from '../Contacts/ContactManager.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import TpdsProjectFlusher from '../ThirdPartyDataStore/TpdsProjectFlusher.mjs'
import CollaboratorsGetter from './CollaboratorsGetter.mjs'
import Errors from '../Errors/Errors.js'
import TpdsUpdateSender from '../ThirdPartyDataStore/TpdsUpdateSender.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'

export default {
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
    setCollaboratorPrivilegeLevel,
    convertTrackChangesToExplicitFormat,
  },
}

async function removeUserFromProject(projectId, userId) {
  try {
    await Project.updateOne(
      { _id: projectId },
      {
        $pull: {
          collaberator_refs: userId,
          readOnly_refs: userId,
          reviewer_refs: userId,
          pendingEditor_refs: userId,
          pendingReviewer_refs: userId,
          tokenAccessReadOnly_refs: userId,
          tokenAccessReadAndWrite_refs: userId,
          archived: userId,
          trashed: userId,
        },
      }
    )
  } catch (err) {
    throw OError.tag(err, 'problem removing user from project collaborators', {
      projectId,
      userId,
    })
  }
}

async function removeUserFromAllProjects(userId) {
  const { readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly } =
    await CollaboratorsGetter.promises.dangerouslyGetAllProjectsUserIsMemberOf(
      userId,
      {
        _id: 1,
      }
    )
  const allProjects = readAndWrite
    .concat(readOnly)
    .concat(tokenReadAndWrite)
    .concat(tokenReadOnly)
  logger.info(
    {
      userId,
      readAndWriteCount: readAndWrite.length,
      readOnlyCount: readOnly.length,
      tokenReadAndWriteCount: tokenReadAndWrite.length,
      tokenReadOnlyCount: tokenReadOnly.length,
    },
    'removing user from projects'
  )
  for (const project of allProjects) {
    await removeUserFromProject(project._id, userId)
  }
  logger.info(
    {
      userId,
      allProjectsCount: allProjects.length,
    },
    'removed user from all projects'
  )
}

async function addUserIdToProject(
  projectId,
  addingUserId,
  userId,
  privilegeLevel,
  { pendingEditor, pendingReviewer } = {}
) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    name: 1,
    collaberator_refs: 1,
    readOnly_refs: 1,
    reviewer_refs: 1,
    track_changes: 1,
  })
  let level
  let existingUsers = project.collaberator_refs || []
  existingUsers = existingUsers.concat(project.reviewer_refs || [])
  existingUsers = existingUsers.concat(project.readOnly_refs || [])
  existingUsers = existingUsers.map(u => u.toString())
  if (existingUsers.includes(userId.toString())) {
    return // User already in Project
  }
  if (privilegeLevel === PrivilegeLevels.READ_AND_WRITE) {
    level = { collaberator_refs: userId }
    logger.debug(
      { privileges: 'readAndWrite', userId, projectId },
      'adding user'
    )
  } else if (privilegeLevel === PrivilegeLevels.READ_ONLY) {
    level = { readOnly_refs: userId }
    if (pendingEditor) {
      level.pendingEditor_refs = userId
    } else if (pendingReviewer) {
      level.pendingReviewer_refs = userId
    }
    logger.debug(
      {
        privileges: 'readOnly',
        userId,
        projectId,
        pendingEditor,
        pendingReviewer,
      },
      'adding user'
    )
  } else if (privilegeLevel === PrivilegeLevels.REVIEW) {
    level = { reviewer_refs: userId }
    logger.debug({ privileges: 'reviewer', userId, projectId }, 'adding user')
  } else {
    throw new Error(`unknown privilegeLevel: ${privilegeLevel}`)
  }

  if (addingUserId) {
    ContactManager.addContact(addingUserId, userId, () => {})
  }

  if (privilegeLevel === PrivilegeLevels.REVIEW) {
    const trackChanges = await convertTrackChangesToExplicitFormat(
      projectId,
      project.track_changes
    )
    trackChanges[userId] = true

    await Project.updateOne(
      { _id: projectId },
      { track_changes: trackChanges, $addToSet: level }
    ).exec()

    EditorRealTimeController.emitToRoom(
      projectId,
      'toggle-track-changes',
      trackChanges
    )
  } else {
    await Project.updateOne({ _id: projectId }, { $addToSet: level }).exec()
  }

  // Ensure there is a dedicated folder for this "new" project.
  await TpdsUpdateSender.promises.createProject({
    projectId,
    projectName: project.name,
    ownerId: project.owner_ref,
    userId,
  })

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
        { readOnly_refs: fromUserId },
      ],
    },
    { _id: 1 }
  ).exec()
  const projectIds = projects.map(p => p._id)
  logger.debug({ projectIds, fromUserId, toUserId }, 'transferring projects')

  await Project.updateMany(
    { owner_ref: fromUserId },
    { $set: { owner_ref: toUserId } }
  ).exec()

  await Project.updateMany(
    { collaberator_refs: fromUserId },
    {
      $addToSet: { collaberator_refs: toUserId },
    }
  ).exec()
  await Project.updateMany(
    { collaberator_refs: fromUserId },
    {
      $pull: { collaberator_refs: fromUserId },
    }
  ).exec()

  await Project.updateMany(
    { readOnly_refs: fromUserId },
    {
      $addToSet: { readOnly_refs: toUserId },
    }
  ).exec()
  await Project.updateMany(
    { readOnly_refs: fromUserId },
    {
      $pull: { readOnly_refs: fromUserId },
    }
  ).exec()

  await Project.updateMany(
    { pendingEditor_refs: fromUserId },
    {
      $addToSet: { pendingEditor_refs: toUserId },
    }
  ).exec()
  await Project.updateMany(
    { pendingEditor_refs: fromUserId },
    {
      $pull: { pendingEditor_refs: fromUserId },
    }
  ).exec()

  await Project.updateMany(
    { pendingReviewer_refs: fromUserId },
    {
      $addToSet: { pendingReviewer_refs: toUserId },
    }
  ).exec()
  await Project.updateMany(
    { pendingReviewer_refs: fromUserId },
    {
      $pull: { pendingReviewer_refs: fromUserId },
    }
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
  privilegeLevel,
  { pendingEditor, pendingReviewer } = {}
) {
  // Make sure we're only updating the project if the user is already a
  // collaborator
  const query = {
    _id: projectId,
    $or: [
      { collaberator_refs: userId },
      { readOnly_refs: userId },
      { reviewer_refs: userId },
    ],
  }
  let update

  switch (privilegeLevel) {
    case PrivilegeLevels.READ_AND_WRITE: {
      update = {
        $pull: {
          readOnly_refs: userId,
          pendingEditor_refs: userId,
          reviewer_refs: userId,
          pendingReviewer_refs: userId,
        },
        $addToSet: { collaberator_refs: userId },
      }
      break
    }
    case PrivilegeLevels.REVIEW: {
      update = {
        $pull: {
          readOnly_refs: userId,
          pendingEditor_refs: userId,
          collaberator_refs: userId,
          pendingReviewer_refs: userId,
        },
        $addToSet: { reviewer_refs: userId },
      }

      const project = await ProjectGetter.promises.getProject(projectId, {
        track_changes: true,
      })
      const newTrackChangesState = await convertTrackChangesToExplicitFormat(
        projectId,
        project.track_changes
      )
      if (newTrackChangesState[userId] !== true) {
        newTrackChangesState[userId] = true
      }
      if (typeof project.track_changes === 'object') {
        update.$set = { [`track_changes.${userId}`]: true }
      } else {
        update.$set = { track_changes: newTrackChangesState }
      }
      break
    }
    case PrivilegeLevels.READ_ONLY: {
      update = {
        $pull: { collaberator_refs: userId, reviewer_refs: userId },
        $addToSet: { readOnly_refs: userId },
      }

      if (pendingEditor) {
        update.$addToSet.pendingEditor_refs = userId
      } else {
        update.$pull.pendingEditor_refs = userId
      }

      if (pendingReviewer) {
        update.$addToSet.pendingReviewer_refs = userId
      } else {
        update.$pull.pendingReviewer_refs = userId
      }

      break
    }
    default: {
      throw new OError(`unknown privilege level: ${privilegeLevel}`)
    }
  }
  const mongoResponse = await Project.updateOne(query, update).exec()
  if (mongoResponse.matchedCount === 0) {
    throw new Errors.NotFoundError('project or collaborator not found')
  }

  if (update.$set?.track_changes) {
    EditorRealTimeController.emitToRoom(
      projectId,
      'toggle-track-changes',
      update.$set.track_changes
    )
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
          { tokenAccessReadAndWrite_refs: userId },
        ],
      },
      {
        _id: 1,
      }
    )
    return project != null
  } catch (err) {
    throw OError.tag(err, 'problem while checking if user is token member', {
      userId,
      projectId,
    })
  }
}

async function _flushProjects(projectIds) {
  for (const projectId of projectIds) {
    await TpdsProjectFlusher.promises.flushProjectToTpds(projectId)
  }
}

async function convertTrackChangesToExplicitFormat(
  projectId,
  trackChangesState
) {
  if (typeof trackChangesState === 'object') {
    return { ...trackChangesState }
  }

  if (trackChangesState === true) {
    // track changes are enabled for all
    const members =
      await CollaboratorsGetter.promises.getMemberIdsWithPrivilegeLevels(
        projectId
      )

    const newTrackChangesState = {}
    for (const { id, privilegeLevel } of members) {
      if (
        [
          PrivilegeLevels.OWNER,
          PrivilegeLevels.READ_AND_WRITE,
          PrivilegeLevels.REVIEW,
        ].includes(privilegeLevel)
      ) {
        newTrackChangesState[id] = true
      }
    }

    return newTrackChangesState
  }

  return {}
}
