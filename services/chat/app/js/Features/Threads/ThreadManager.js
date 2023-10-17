import { db, ObjectId } from '../../mongodb.js'

export const GLOBAL_THREAD = 'GLOBAL'

export async function findOrCreateThread(projectId, threadId) {
  let query, update
  projectId = new ObjectId(projectId.toString())
  if (threadId !== GLOBAL_THREAD) {
    threadId = new ObjectId(threadId.toString())
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
  return result
}

export async function findAllThreadRooms(projectId) {
  return db.rooms
    .find(
      {
        project_id: new ObjectId(projectId.toString()),
        thread_id: { $exists: true },
      },
      {
        thread_id: 1,
        resolved: 1,
      }
    )
    .toArray()
}

export async function findAllThreadRoomsAndGlobalThread(projectId) {
  return db.rooms
    .find(
      {
        project_id: new ObjectId(projectId.toString()),
      },
      {
        thread_id: 1,
        resolved: 1,
      }
    )
    .toArray()
}

export async function resolveThread(projectId, threadId, userId) {
  await db.rooms.updateOne(
    {
      project_id: new ObjectId(projectId.toString()),
      thread_id: new ObjectId(threadId.toString()),
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

export async function reopenThread(projectId, threadId) {
  await db.rooms.updateOne(
    {
      project_id: new ObjectId(projectId.toString()),
      thread_id: new ObjectId(threadId.toString()),
    },
    {
      $unset: {
        resolved: true,
      },
    }
  )
}

export async function deleteThread(projectId, threadId) {
  const room = await findOrCreateThread(projectId, threadId)
  await db.rooms.deleteOne({
    _id: room._id,
  })
  return room._id
}

export async function deleteAllThreadsInProject(projectId) {
  await db.rooms.deleteMany({
    project_id: new ObjectId(projectId.toString()),
  })
}
