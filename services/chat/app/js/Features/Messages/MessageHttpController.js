import logger from '@overleaf/logger'
import { parseReq } from '@overleaf/validation-tools'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import * as MessageManager from './MessageManager.js'
import * as MessageFormatter from './MessageFormatter.js'
import * as ThreadManager from '../Threads/ThreadManager.js'
import * as Schemas from './MessageHttpSchemas.js'

export async function getStatus(req, res) {
  const message = 'chat is alive'
  res.send(message)
}

export async function getGlobalMessages(req, res) {
  const {
    params: { projectId },
    query: { before, limit },
  } = parseReq(req, Schemas.getGlobalMessages)
  await _getMessages(projectId, ThreadManager.GLOBAL_THREAD, before, limit, res)
}

export async function getGlobalMessage(req, res) {
  const {
    params: { projectId, messageId },
  } = parseReq(req, Schemas.getGlobalMessage)
  logger.debug({ projectId, messageId }, 'getting single global message')
  try {
    const room = await ThreadManager.findThread(
      projectId,
      ThreadManager.GLOBAL_THREAD
    )

    const message = await MessageManager.getMessage(room._id, messageId)
    const formattedMsg = MessageFormatter.formatMessageForClientSide(message)

    res.json(formattedMsg)
  } catch (error) {
    if (
      error instanceof ThreadManager.MissingThreadError ||
      error instanceof MessageManager.MissingMessageError
    ) {
      res.sendStatus(404)
      return
    }
    throw error
  }
}

export async function sendGlobalMessage(req, res) {
  const {
    params: { projectId },
    body: { user_id: userId, content },
  } = parseReq(req, Schemas.sendGlobalMessage)
  await _sendMessage(
    userId,
    projectId,
    content,
    ThreadManager.GLOBAL_THREAD,
    res
  )
}

export async function sendMessage(req, res) {
  const {
    params: { projectId, threadId },
    body: { user_id: userId, content },
  } = parseReq(req, Schemas.sendMessage)
  await _sendMessage(userId, projectId, content, threadId, res)
}

export async function getThreads(req, res) {
  const {
    params: { projectId },
  } = parseReq(req, Schemas.getThreads)
  logger.debug({ projectId }, 'getting all threads')
  const rooms = await ThreadManager.findAllThreadRooms(projectId)
  const roomIds = rooms.map(r => r._id)
  const messages = await MessageManager.findAllMessagesInRooms(roomIds)
  const threads = MessageFormatter.groupMessagesByThreads(rooms, messages)
  res.json(threads)
}

export async function generateThreadData(req, res) {
  const {
    params: { projectId },
    body: { threads },
  } = parseReq(req, Schemas.generateThreadData)
  logger.debug({ projectId }, 'getting all threads')
  const rooms = await ThreadManager.findThreadsById(projectId, threads)
  const roomIds = rooms.map(r => r._id)
  const messages = await MessageManager.findAllMessagesInRooms(roomIds)
  logger.debug({ rooms, messages }, 'looked up messages in the rooms')
  const threadData = MessageFormatter.groupMessagesByThreads(rooms, messages)
  res.json(threadData)
}

export async function getThread(req, res) {
  const {
    params: { projectId, threadId },
  } = parseReq(req, Schemas.getThread)
  logger.debug({ projectId, threadId }, 'getting specific thread')
  try {
    const room = await ThreadManager.findThread(projectId, threadId)
    const messages = await MessageManager.findAllMessagesInRooms([room._id])
    const threads = MessageFormatter.groupMessagesByThreads([room], messages)

    const thread = threads[threadId] || null
    if (!thread) {
      res.sendStatus(404)
      return
    }
    res.json(thread)
  } catch (error) {
    if (error instanceof ThreadManager.MissingThreadError) {
      res.sendStatus(404)
      return
    }
    throw error
  }
}

export async function getThreadMessage(req, res) {
  const {
    params: { projectId, threadId, messageId },
  } = parseReq(req, Schemas.getThreadMessage)
  logger.debug(
    { projectId, threadId, messageId },
    'getting single thread message'
  )
  try {
    const room = await ThreadManager.findThread(projectId, threadId)
    const message = await MessageManager.getMessage(room._id, messageId)
    const formattedMsg = MessageFormatter.formatMessageForClientSide(message)

    res.json(formattedMsg)
  } catch (error) {
    if (
      error instanceof ThreadManager.MissingThreadError ||
      error instanceof MessageManager.MissingMessageError
    ) {
      res.sendStatus(404)
      return
    }
    throw error
  }
}

export async function resolveThread(req, res) {
  const {
    params: { projectId, threadId },
    body: { user_id: userId },
  } = parseReq(req, Schemas.resolveThread)
  logger.debug({ userId, projectId, threadId }, 'marking thread as resolved')
  await ThreadManager.resolveThread(projectId, threadId, userId)
  res.sendStatus(204)
}

export async function reopenThread(req, res) {
  const {
    params: { projectId, threadId },
  } = parseReq(req, Schemas.reopenThread)
  logger.debug({ projectId, threadId }, 'reopening thread')
  await ThreadManager.reopenThread(projectId, threadId)
  res.sendStatus(204)
}

export async function deleteThread(req, res) {
  const {
    params: { projectId, threadId },
  } = parseReq(req, Schemas.deleteThread)
  logger.debug({ projectId, threadId }, 'deleting thread')
  const roomId = await ThreadManager.deleteThread(projectId, threadId)
  await MessageManager.deleteAllMessagesInRoom(roomId)
  res.sendStatus(204)
}

export async function editMessage(req, res) {
  const {
    params: { projectId, threadId, messageId },
    body: { content, userId },
  } = parseReq(req, Schemas.editMessage)
  logger.debug({ projectId, threadId, messageId, content }, 'editing message')
  const room = await ThreadManager.findOrCreateThread(projectId, threadId)
  const found = await MessageManager.updateMessage(
    room._id,
    messageId,
    userId,
    content,
    Date.now()
  )
  if (!found) {
    res.sendStatus(404)
    return
  }
  res.sendStatus(204)
}

export async function editGlobalMessage(req, res) {
  const {
    params: { projectId, messageId },
    body: { content, userId },
  } = parseReq(req, Schemas.editGlobalMessage)
  logger.debug({ projectId, messageId, content }, 'editing global message')
  const room = await ThreadManager.findOrCreateThread(
    projectId,
    ThreadManager.GLOBAL_THREAD
  )
  const found = await MessageManager.updateMessage(
    room._id,
    messageId,
    userId,
    content,
    Date.now()
  )
  if (!found) {
    res.sendStatus(404)
    return
  }
  res.sendStatus(204)
}

export async function deleteMessage(req, res) {
  const {
    params: { projectId, threadId, messageId },
  } = parseReq(req, Schemas.deleteMessage)
  logger.debug({ projectId, threadId, messageId }, 'deleting message')
  const room = await ThreadManager.findOrCreateThread(projectId, threadId)
  await MessageManager.deleteMessage(room._id, messageId)
  res.sendStatus(204)
}

export async function deleteUserMessage(req, res) {
  const {
    params: { projectId, threadId, userId, messageId },
  } = parseReq(req, Schemas.deleteUserMessage)
  const room = await ThreadManager.findOrCreateThread(projectId, threadId)
  await MessageManager.deleteUserMessage(userId, room._id, messageId)
  res.sendStatus(204)
}

export async function deleteGlobalMessage(req, res) {
  const {
    params: { projectId, messageId },
  } = parseReq(req, Schemas.deleteGlobalMessage)
  const room = await ThreadManager.findOrCreateThread(
    projectId,
    ThreadManager.GLOBAL_THREAD
  )
  await MessageManager.deleteMessage(room._id, messageId)
  res.sendStatus(204)
}

export async function getResolvedThreadIds(req, res) {
  const {
    params: { projectId },
  } = parseReq(req, Schemas.getResolvedThreadIds)
  const resolvedThreadIds = await ThreadManager.getResolvedThreadIds(projectId)
  res.json({ resolvedThreadIds })
}

export async function destroyProject(req, res) {
  const {
    params: { projectId },
  } = parseReq(req, Schemas.destroyProject)
  logger.debug({ projectId }, 'destroying project')
  const rooms = await ThreadManager.findAllThreadRoomsAndGlobalThread(projectId)
  const roomIds = rooms.map(r => r._id)
  logger.debug({ projectId, roomIds }, 'deleting all messages in rooms')
  await MessageManager.deleteAllMessagesInRooms(roomIds)
  logger.debug({ projectId }, 'deleting all threads in project')
  await ThreadManager.deleteAllThreadsInProject(projectId)
  res.sendStatus(204)
}

async function _sendMessage(userId, projectId, content, clientThreadId, res) {
  logger.debug(
    { clientThreadId, projectId, userId, content },
    'new message received'
  )
  const thread = await ThreadManager.findOrCreateThread(
    projectId,
    clientThreadId
  )
  let message = await MessageManager.createMessage(
    thread._id,
    userId,
    content,
    Date.now()
  )
  message = MessageFormatter.formatMessageForClientSide(message)
  message.room_id = projectId

  res.status(201).json(message)
}

async function _getMessages(projectId, clientThreadId, before, limit, res) {
  logger.debug(
    { limit, before, projectId, clientThreadId },
    'get message request received'
  )
  const thread = await ThreadManager.findOrCreateThread(
    projectId,
    clientThreadId
  )
  const threadObjectId = thread._id
  logger.debug(
    { limit, before, projectId, clientThreadId, threadObjectId },
    'found or created thread'
  )
  let messages = await MessageManager.getMessages(threadObjectId, limit, before)
  messages = MessageFormatter.formatMessagesForClientSide(messages)
  logger.debug({ projectId, messages }, 'got messages')
  res.json(messages)
}

export async function duplicateCommentThreads(req, res) {
  const {
    params: { projectId },
    body: { threads },
  } = parseReq(req, Schemas.duplicateCommentThreads)
  const result = {}
  for (const id of threads) {
    logger.debug({ projectId, thread: id }, 'duplicating thread')
    try {
      const { oldRoom, newRoom } = await ThreadManager.duplicateThread(
        projectId,
        id
      )
      await MessageManager.duplicateRoomToOtherRoom(oldRoom._id, newRoom._id)
      result[id] = { duplicateId: newRoom.thread_id }
    } catch (error) {
      if (error instanceof ThreadManager.MissingThreadError) {
        // Expected error when the comment has been deleted prior to duplication
        result[id] = { error: 'not found' }
      } else {
        logger.err({ error }, 'error duplicating thread')
        result[id] = { error: 'unknown' }
      }
    }
  }
  res.json({ newThreads: result })
}

export async function cloneCommentThreads(req, res) {
  const {
    params: { projectId: sourceProjectId },
    body: { targetProjectId },
  } = parseReq(req, Schemas.cloneCommentThreads)
  const rooms = await ThreadManager.cloneThreads(
    sourceProjectId,
    targetProjectId
  )
  await promiseMapWithLimit(10, rooms, async ({ from, to }) => {
    await MessageManager.duplicateRoomToOtherRoom(from, to)
  })
  res.sendStatus(204)
}
