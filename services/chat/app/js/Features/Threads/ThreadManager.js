import { db, ObjectId } from '../../mongodb.js'

export class MissingThreadError extends Error {}

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
  return await db.rooms
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
  return await db.rooms
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

export async function getResolvedThreadIds(projectId) {
  const resolvedThreadIds = await db.rooms
    .find(
      {
        project_id: new ObjectId(projectId),
        thread_id: { $exists: true },
        resolved: { $exists: true },
      },
      { projection: { thread_id: 1 } }
    )
    .map(record => record.thread_id.toString())
    .toArray()
  return resolvedThreadIds
}

export async function duplicateThread(projectId, threadId) {
  const room = await db.rooms.findOne({
    project_id: new ObjectId(projectId),
    thread_id: new ObjectId(threadId),
  })
  if (!room) {
    throw new MissingThreadError('Trying to duplicate a non-existent thread')
  }
  const newRoom = {
    project_id: room.project_id,
    thread_id: new ObjectId(),
  }
  if (room.resolved) {
    newRoom.resolved = room.resolved
  }
  const confirmation = await db.rooms.insertOne(newRoom)
  newRoom._id = confirmation.insertedId
  return { oldRoom: room, newRoom }
}

export async function findThread(projectId, threadId) {
  projectId = new ObjectId(projectId.toString())
  if (threadId !== GLOBAL_THREAD) {
    threadId = new ObjectId(threadId.toString())
  }

  const room = await db.rooms.findOne({
    project_id: projectId,
    thread_id: threadId === GLOBAL_THREAD ? { $exists: false } : threadId,
  })
  if (!room) {
    throw new MissingThreadError('Thread not found')
  }
  return room
}

export async function findThreadsById(projectId, threadIds) {
  return await db.rooms
    .find({
      project_id: new ObjectId(projectId),
      thread_id: { $in: threadIds.map(id => new ObjectId(id)) },
    })
    .toArray()
}
