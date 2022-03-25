const READ_CONCURRENCY_SECONDARY =
  parseInt(process.env.READ_CONCURRENCY_SECONDARY, 10) || 1000
const READ_CONCURRENCY_PRIMARY =
  parseInt(process.env.READ_CONCURRENCY_PRIMARY, 10) || 500
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
const MAX_CHATS_TO_DESTROY =
  parseInt(process.env.MAX_CHATS_TO_DESTROY, 10) || false
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
// raise mongo timeout to 10mins if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 600000

const { ObjectId, ReadPreference } = require('mongodb')
const { db } = require('../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../app/src/util/promises')
const { batchedUpdate } = require('./helpers/batchedUpdate')
const ChatApiHandler = require('../app/src/Features/Chat/ChatApiHandler')

console.log({
  DRY_RUN,
  WRITE_CONCURRENCY,
  BATCH_SIZE,
  MAX_CHATS_TO_DESTROY,
})

const RESULT = {
  DRY_RUN,
  projectChatsDestroyed: 0,
  continueFrom: null,
}

async function processBatch(_, rooms) {
  if (rooms.length && rooms[0]._id) {
    RESULT.continueFrom = rooms[0]._id
  }

  // Logic taken from delete_orphaned_docs_online_check.js
  // gets projectIds from rooms,
  // then checks 'expired' status of project

  const projectIds = Array.from(
    new Set(rooms.map(room => room.project_id.toString()))
  ).map(ObjectId)
  console.log(
    `Checking projects (${projectIds.length})`,
    JSON.stringify(projectIds)
  )

  const doubleCheckProjectIdsOnPrimary = []
  async function checkProjectOnSecondary(projectId) {
    if (await checkProjectExistsOnSecondary(projectId)) {
      // Finding a project with secondary confidence is sufficient.
      return
    }
    // At this point, the secondaries deem this project as having orphaned chat.
    doubleCheckProjectIdsOnPrimary.push(projectId)
  }

  const projectsWithOrphanedChat = []
  async function checkProjectOnPrimary(projectId) {
    if (await checkProjectExistsOnPrimary(projectId)) {
      // The project is actually live.
      return
    }
    projectsWithOrphanedChat.push(projectId)
  }

  await promiseMapWithLimit(
    READ_CONCURRENCY_SECONDARY,
    projectIds,
    checkProjectOnSecondary
  )
  await promiseMapWithLimit(
    READ_CONCURRENCY_PRIMARY,
    doubleCheckProjectIdsOnPrimary,
    checkProjectOnPrimary
  )

  console.log(
    `Destroying chat for projects (${projectsWithOrphanedChat.length})`,
    JSON.stringify(projectsWithOrphanedChat)
  )
  if (!DRY_RUN) {
    await promiseMapWithLimit(
      WRITE_CONCURRENCY,
      projectsWithOrphanedChat,
      ChatApiHandler.promises.destroyProject
    )
  }
  RESULT.projectChatsDestroyed += projectsWithOrphanedChat.length

  console.log(RESULT)
  if (
    MAX_CHATS_TO_DESTROY &&
    RESULT.projectChatsDestroyed >= MAX_CHATS_TO_DESTROY
  ) {
    console.log(
      `MAX_CHATS_TO_DELETE limit (${MAX_CHATS_TO_DESTROY}) reached. Stopping.`
    )
    process.exit(0)
  }
}

async function getDeletedProject(projectId, readPreference) {
  return await db.deletedProjects.findOne(
    { 'deleterData.deletedProjectId': projectId },
    {
      // There is no index on .project. Pull down something small.
      projection: { 'project._id': 1 },
      readPreference,
    }
  )
}

async function getProject(projectId, readPreference) {
  return await db.projects.findOne(
    { _id: projectId },
    {
      // Pulling down an empty object is fine for differentiating with null.
      projection: { _id: 0 },
      readPreference,
    }
  )
}

async function checkProjectExistsWithReadPreference(projectId, readPreference) {
  // NOTE: Possible race conditions!
  // There are two processes which are racing with our queries:
  //  1. project deletion
  //  2. project restoring
  // For 1. we check the projects collection before deletedProjects.
  // If a project were to be delete in this very moment, we should see the
  //  soft-deleted entry which is created before deleting the projects entry.
  // For 2. we check the projects collection after deletedProjects again.
  // If a project were to be restored in this very moment, it is very likely
  //  to see the projects entry again.
  // Unlikely edge case: Restore+Deletion in rapid succession.
  // We could add locking to the ProjectDeleter for ruling ^ out.
  if (await getProject(projectId, readPreference)) {
    // The project is live.
    return true
  }
  const deletedProject = await getDeletedProject(projectId, readPreference)
  if (deletedProject && deletedProject.project) {
    // The project is registered for hard-deletion.
    return true
  }
  if (await getProject(projectId, readPreference)) {
    // The project was just restored.
    return true
  }
  // The project does not exist.
  return false
}

async function checkProjectExistsOnPrimary(projectId) {
  return await checkProjectExistsWithReadPreference(
    projectId,
    ReadPreference.PRIMARY
  )
}

async function checkProjectExistsOnSecondary(projectId) {
  return await checkProjectExistsWithReadPreference(
    projectId,
    ReadPreference.SECONDARY
  )
}

async function main() {
  const projection = {
    _id: 1,
    project_id: 1,
  }
  await batchedUpdate('rooms', {}, processBatch, projection)
  console.log('Final')
  console.log(RESULT)
}

main()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
