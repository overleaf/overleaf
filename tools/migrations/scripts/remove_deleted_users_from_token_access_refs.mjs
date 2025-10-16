import { db, READ_PREFERENCE_SECONDARY } from '../lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import mongodb from 'mongodb'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'

const { ObjectId } = mongodb

async function findUserIds() {
  const userIds = new Set()
  const cursor = db.users.find(
    {},
    {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
  for await (const user of cursor) {
    userIds.add(user._id.toString())
    if (userIds.size % 1_000_000 === 0) {
      console.log(`=> ${userIds.size} users added`, new Date().toISOString())
    }
  }
  console.log(`=> User ids count: ${userIds.size}`)
  return userIds
}

export default async function fixProjectsWithInvalidTokenAccessRefsIds() {
  const DELETED_USER_COLLABORATOR_IDS = new Set()
  const PROJECTS_WITH_DELETED_USER = new Set()

  // get a set of all users ids as an in-memory cache
  const userIds = await findUserIds()

  // default query for finding all projects with non-existing/null or non-empty token access fields
  const query = {
    $or: [
      { tokenAccessReadOnly_refs: { $not: { $type: 'array' } } },
      { tokenAccessReadAndWrite_refs: { $not: { $type: 'array' } } },
      { 'tokenAccessReadOnly_refs.0': { $exists: true } },
      { 'tokenAccessReadAndWrite_refs.0': { $exists: true } },
    ],
  }

  await batchedUpdate(
    db.projects,
    query,
    async projects => {
      for (const project of projects) {
        const isTokenAccessFieldMissing =
          !project.tokenAccessReadOnly_refs ||
          !project.tokenAccessReadAndWrite_refs
        project.tokenAccessReadOnly_refs ??= []
        project.tokenAccessReadAndWrite_refs ??= []

        // update the token access fields if necessary
        if (isTokenAccessFieldMissing) {
          const fields = [
            'tokenAccessReadOnly_refs',
            'tokenAccessReadAndWrite_refs',
          ]
          for (const field of fields) {
            await db.projects.updateOne(
              {
                _id: project._id,
                [field]: { $not: { $type: 'array' } },
              },
              { $set: { [field]: [] } }
            )
          }
          console.log(
            `=> Fixed non-existing token access fields in project ${project._id.toString()}`
          )
        }

        // find the set of user ids that are in the token access fields
        // i.e. the set of collaborators
        const collaboratorIds = new Set()
        for (const roUserId of project.tokenAccessReadOnly_refs) {
          collaboratorIds.add(roUserId.toString())
        }
        for (const rwUserId of project.tokenAccessReadAndWrite_refs) {
          collaboratorIds.add(rwUserId.toString())
        }
        // determine which collaborator ids are not in the `users` collection
        // i.e. the user has been deleted
        const deletedUserIds = new Set()
        for (const collaboratorId of collaboratorIds) {
          if (!userIds.has(collaboratorId)) {
            deletedUserIds.add(collaboratorId)
          }
        }

        // double-check that users doesn't exist in the users collection
        // we don't want to remove users that were added after the initial query
        const existingUsersCursor = db.users.find(
          { _id: { $in: [...deletedUserIds].map(id => new ObjectId(id)) } },
          { _id: 1 }
        )
        for await (const user of existingUsersCursor) {
          const id = user._id.toString()
          deletedUserIds.delete(id)
          // add the user id to the cache
          userIds.add(id)
        }

        // remove the actual deleted users
        for (const deletedUserId of deletedUserIds) {
          DELETED_USER_COLLABORATOR_IDS.add(deletedUserId)
          PROJECTS_WITH_DELETED_USER.add(project._id.toString())
          console.log(
            '=> Found deleted user id:',
            deletedUserId,
            'in project:',
            project._id.toString()
          )
          console.log(
            `=> Removing deleted ${deletedUserId} from all projects (found in project ${project._id.toString()})`
          )
          await removeUserFromAllProjects(new ObjectId(deletedUserId))
        }
      }
    },
    { tokenAccessReadOnly_refs: 1, tokenAccessReadAndWrite_refs: 1 }
  )

  console.log(`Deleted user ids (${DELETED_USER_COLLABORATOR_IDS.size})`)
  if (DELETED_USER_COLLABORATOR_IDS.size) {
    console.log(Array.from(DELETED_USER_COLLABORATOR_IDS).join('\n'))
  }
  console.log(
    `=> Projects with deleted user ids (${PROJECTS_WITH_DELETED_USER.size})`
  )
  if (PROJECTS_WITH_DELETED_USER.size) {
    console.log(Array.from(PROJECTS_WITH_DELETED_USER).join('\n'))
  }
}

// Copied from services/web/app/src/Features/Collaborators/CollaboratorsHandler.js
async function removeUserFromAllProjects(userId) {
  const { readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly } =
    await dangerouslyGetAllProjectsUserIsMemberOf(userId, { _id: 1 })
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

// Copied from services/web/app/src/Features/Collaborators/CollaboratorsHandler.js
async function removeUserFromProject(projectId, userId) {
  try {
    await db.projects.updateOne(
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

// Copied from services/web/app/src/Features/Collaborators/CollaboratorsGetter.js
// This function returns all the projects that a user is a member of, regardless of
// the current state of the project, so it includes those projects where token access
// has been disabled.
async function dangerouslyGetAllProjectsUserIsMemberOf(userId, fields) {
  const readAndWrite = await db.projects
    .find({ collaberator_refs: userId }, fields)
    .toArray()
  const readOnly = await db.projects
    .find({ readOnly_refs: userId }, fields)
    .toArray()
  const tokenReadAndWrite = await db.projects
    .find({ tokenAccessReadAndWrite_refs: userId }, fields)
    .toArray()
  const tokenReadOnly = await db.projects
    .find({ tokenAccessReadOnly_refs: userId }, fields)
    .toArray()
  return { readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly }
}
