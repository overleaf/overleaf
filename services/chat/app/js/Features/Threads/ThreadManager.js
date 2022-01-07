let ThreadManager
const { db, ObjectId } = require('../../mongodb')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const { callbackify } = require('util')

const GLOBAL_THREAD = 'GLOBAL'

async function findOrCreateThread(projectId, threadId) {
  let query, update
  projectId = ObjectId(projectId.toString())
  if (threadId !== GLOBAL_THREAD) {
    threadId = ObjectId(threadId.toString())
  }

  if (threadId === GLOBAL_THREAD) {
    query = {
      project_id: projectId,
      thread_id: { $exists: false },
    }
    update = {
      project_id: projectId,
    }
  } else {
    query = {
      project_id: projectId,
      thread_id: threadId,
    }
    update = {
      project_id: projectId,
      thread_id: threadId,
    }
  }

  const result = await db.rooms.findOneAndUpdate(
    query,
    { $set: update },
    { upsert: true, returnDocument: 'after' }
  )
  return result.value
}

async function findAllThreadRooms(projectId) {
  return db.rooms
    .find(
      {
        project_id: ObjectId(projectId.toString()),
        thread_id: { $exists: true },
      },
      {
        thread_id: 1,
        resolved: 1,
      }
    )
    .toArray()
}

async function resolveThread(projectId, threadId, userId) {
  await db.rooms.updateOne(
    {
      project_id: ObjectId(projectId.toString()),
      thread_id: ObjectId(threadId.toString()),
    },
    {
      $set: {
        resolved: {
          user_id: userId,
          ts: new Date(),
        },
      },
    }
  )
}

async function reopenThread(projectId, threadId) {
  await db.rooms.updateOne(
    {
      project_id: ObjectId(projectId.toString()),
      thread_id: ObjectId(threadId.toString()),
    },
    {
      $unset: {
        resolved: true,
      },
    }
  )
}

async function deleteThread(projectId, threadId) {
  const room = await findOrCreateThread(projectId, threadId)
  await db.rooms.deleteOne({
    _id: room._id,
  })
  return room._id
}

module.exports = ThreadManager = {
  GLOBAL_THREAD,
  findOrCreateThread: callbackify(findOrCreateThread),
  findAllThreadRooms: callbackify(findAllThreadRooms),
  resolveThread: callbackify(resolveThread),
  reopenThread: callbackify(reopenThread),
  deleteThread: callbackify(deleteThread),
}
;[
  'findOrCreateThread',
  'findAllThreadRooms',
  'resolveThread',
  'reopenThread',
  'deleteThread',
].map(method =>
  metrics.timeAsyncMethod(ThreadManager, method, 'mongo.ThreadManager', logger)
)
