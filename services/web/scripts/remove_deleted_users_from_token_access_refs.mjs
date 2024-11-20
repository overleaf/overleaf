import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import mongodb from 'mongodb-legacy'
import minimist from 'minimist'
import CollaboratorsHandler from '../app/src/Features/Collaborators/CollaboratorsHandler.js'
import { fileURLToPath } from 'node:url'

const { ObjectId } = mongodb

const argv = minimist(process.argv.slice(2), {
  string: ['projects'],
  boolean: ['dry-run', 'help'],
  alias: {
    projects: 'p',
  },
  default: {
    'dry-run': true,
  },
})

const DRY_RUN = argv['dry-run']
const PROJECTS_LIST = argv.projects

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

async function fixProjectsWithInvalidTokenAccessRefsIds(
  DRY_RUN,
  PROJECTS_LIST
) {
  if (DRY_RUN) {
    console.log('=> Doing dry run')
  }

  const DELETED_USER_COLLABORATOR_IDS = new Set()
  const PROJECTS_WITH_DELETED_USER = new Set()

  // get a set of all users ids as an in-memory cache
  const userIds = await findUserIds()

  // default query for finding all projects with non-existing/null or non-empty token access fields
  let query = {
    $or: [
      { tokenAccessReadOnly_refs: { $not: { $type: 'array' } } },
      { tokenAccessReadAndWrite_refs: { $not: { $type: 'array' } } },
      { 'tokenAccessReadOnly_refs.0': { $exists: true } },
      { 'tokenAccessReadAndWrite_refs.0': { $exists: true } },
    ],
  }

  const projectIds = PROJECTS_LIST?.split(',').map(
    projectId => new ObjectId(projectId)
  )

  // query for finding projects passed in as args
  if (projectIds) {
    query = { $and: [{ _id: { $in: projectIds } }] }
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
          if (DRY_RUN) {
            console.log(
              `=> DRY RUN - would fix non-existing token access fields in project ${project._id.toString()}`
            )
          } else {
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
          if (DRY_RUN) {
            console.log(
              `=> DRY RUN - would remove deleted ${deletedUserId} from all projects (found in project ${project._id.toString()})`
            )
            continue
          }
          console.log(
            `=> Removing deleted ${deletedUserId} from all projects (found in project ${project._id.toString()})`
          )
          await CollaboratorsHandler.promises.removeUserFromAllProjects(
            new ObjectId(deletedUserId)
          )
        }
      }
    },
    { tokenAccessReadOnly_refs: 1, tokenAccessReadAndWrite_refs: 1 }
  )

  console.log(
    `=> ${DRY_RUN ? 'DRY RUN - would delete' : 'Deleted'} user ids (${
      DELETED_USER_COLLABORATOR_IDS.size
    })`
  )
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

async function main(DRY_RUN, PROJECTS_LIST) {
  await fixProjectsWithInvalidTokenAccessRefsIds(DRY_RUN, PROJECTS_LIST)
}

export default main

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  if (argv.help || argv._.length > 1) {
    console.error(`Usage: node scripts/remove_deleted_users_from_token_access_refs.mjs [OPTS]
      Finds or removes deleted user ids from token access fields
      "tokenAccessReadOnly_refs" and "tokenAccessReadAndWrite_refs" in the "projects" collection.

      If no projects are specified, all projects will be processed.

      Options:

          --dry-run         finds projects and deleted users but does not do any updates
          --projects        list of projects ids to be fixed (comma separated)
    `)
    process.exit(1)
  }

  try {
    await main(DRY_RUN, PROJECTS_LIST)
    console.error('Done')
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
