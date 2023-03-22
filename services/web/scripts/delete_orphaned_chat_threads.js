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

const { ObjectId } = require('mongodb')
const { promiseMapWithLimit } = require('../app/src/util/promises')
const { batchedUpdate } = require('./helpers/batchedUpdate')
const ChatApiHandler = require('../app/src/Features/Chat/ChatApiHandler')
const { getHardDeletedProjectIds } = require('./delete_orphaned_data_helper')

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

async function processBatch(rooms) {
  if (rooms.length && rooms[0]._id) {
    RESULT.continueFrom = rooms[0]._id
  }
  const projectIds = Array.from(
    new Set(rooms.map(room => room.project_id.toString()))
  ).map(ObjectId)
  console.log(
    `Checking projects (${projectIds.length})`,
    JSON.stringify(projectIds)
  )

  const projectsWithOrphanedChat = await getHardDeletedProjectIds({
    projectIds,
    READ_CONCURRENCY_PRIMARY,
    READ_CONCURRENCY_SECONDARY,
  })

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
