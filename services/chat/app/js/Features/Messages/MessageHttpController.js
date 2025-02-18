import logger from '@overleaf/logger'
import * as MessageManager from './MessageManager.js'
import * as MessageFormatter from './MessageFormatter.js'
import * as ThreadManager from '../Threads/ThreadManager.js'
import { ObjectId } from '../../mongodb.js'

const DEFAULT_MESSAGE_LIMIT = 50
const MAX_MESSAGE_LENGTH = 10 * 1024 // 10kb, about 1,500 words

function readContext(context, req) {
  req.body = context.requestBody
  req.params = context.params.path
  req.query = context.params.query
  if (typeof req.params.projectId !== 'undefined') {
    if (!ObjectId.isValid(req.params.projectId)) {
      context.res.status(400).setBody('Invalid projectId')
    }
  }
  if (typeof req.params.threadId !== 'undefined') {
    if (!ObjectId.isValid(req.params.threadId)) {
      context.res.status(400).setBody('Invalid threadId')
    }
  }
}

/**
 * @param context
 * @param {(req: unknown, res: unknown) => Promise<unknown>} ControllerMethod
 * @returns {Promise<*>}
 */
export async function callMessageHttpController(context, ControllerMethod) {
  const req = {}
  readContext(context, req)
  if (context.res.statusCode !== 400) {
    return await ControllerMethod(req, context.res)
  } else {
    return context.res.body
  }
}

export async function getGlobalMessages(context) {
  return await callMessageHttpController(context, _getGlobalMessages)
}

export async function sendGlobalMessage(context) {
  return await callMessageHttpController(context, _sendGlobalMessage)
}

export async function sendMessage(context) {
  return await callMessageHttpController(context, _sendThreadMessage)
}

export async function getThreads(context) {
  return await callMessageHttpController(context, _getAllThreads)
}

export async function resolveThread(context) {
  return await callMessageHttpController(context, _resolveThread)
}

export async function reopenThread(context) {
  return await callMessageHttpController(context, _reopenThread)
}

export async function deleteThread(context) {
  return await callMessageHttpController(context, _deleteThread)
}

export async function editMessage(context) {
  return await callMessageHttpController(context, _editMessage)
}

export async function deleteMessage(context) {
  return await callMessageHttpController(context, _deleteMessage)
}

export async function deleteUserMessage(context) {
  return await callMessageHttpController(context, _deleteUserMessage)
}

export async function getResolvedThreadIds(context) {
  return await callMessageHttpController(context, _getResolvedThreadIds)
}

export async function destroyProject(context) {
  return await callMessageHttpController(context, _destroyProject)
}

export async function duplicateCommentThreads(context) {
  return await callMessageHttpController(context, _duplicateCommentThreads)
}

export async function generateThreadData(context) {
  return await callMessageHttpController(context, _generateThreadData)
}

export async function getStatus(context) {
  const message = 'chat is alive'
  context.res.status(200).setBody(message)
  return message
}

const _getGlobalMessages = async (req, res) => {
  await _getMessages(ThreadManager.GLOBAL_THREAD, req, res)
}

async function _sendGlobalMessage(req, res) {
  const { user_id: userId, content } = req.body
  const { projectId } = req.params
  return await _sendMessage(
    userId,
    projectId,
    content,
    ThreadManager.GLOBAL_THREAD,
    res
  )
}

async function _sendThreadMessage(req, res) {
  const { user_id: userId, content } = req.body
  const { projectId, threadId } = req.params
  return await _sendMessage(userId, projectId, content, threadId, res)
}

const _getAllThreads = async (req, res) => {
  const { projectId } = req.params
  logger.debug({ projectId }, 'getting all threads')
  const rooms = await ThreadManager.findAllThreadRooms(projectId)
  const roomIds = rooms.map(r => r._id)
  const messages = await MessageManager.findAllMessagesInRooms(roomIds)
  const threads = MessageFormatter.groupMessagesByThreads(rooms, messages)
  res.json(threads)
}

const _generateThreadData = async (req, res) => {
  const { projectId } = req.params
  const { threads } = req.body
  logger.debug({ projectId }, 'getting all threads')
  const rooms = await ThreadManager.findThreadsById(projectId, threads)
  const roomIds = rooms.map(r => r._id)
  const messages = await MessageManager.findAllMessagesInRooms(roomIds)
  logger.debug({ rooms, messages }, 'looked up messages in the rooms')
  const threadData = MessageFormatter.groupMessagesByThreads(rooms, messages)
  res.json(threadData)
}

const _resolveThread = async (req, res) => {
  const { projectId, threadId } = req.params
  const { user_id: userId } = req.body
  logger.debug({ userId, projectId, threadId }, 'marking thread as resolved')
  await ThreadManager.resolveThread(projectId, threadId, userId)
  res.status(204)
}

const _reopenThread = async (req, res) => {
  const { projectId, threadId } = req.params
  logger.debug({ projectId, threadId }, 'reopening thread')
  await ThreadManager.reopenThread(projectId, threadId)
  res.status(204)
}

const _deleteThread = async (req, res) => {
  const { projectId, threadId } = req.params
  logger.debug({ projectId, threadId }, 'deleting thread')
  const roomId = await ThreadManager.deleteThread(projectId, threadId)
  await MessageManager.deleteAllMessagesInRoom(roomId)
  res.status(204)
}

const _editMessage = async (req, res) => {
  const { content, userId } = req.body
  const { projectId, threadId, messageId } = req.params
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
    res.status(404)
    return
  }
  res.status(204)
}

const _deleteMessage = async (req, res) => {
  const { projectId, threadId, messageId } = req.params
  logger.debug({ projectId, threadId, messageId }, 'deleting message')
  const room = await ThreadManager.findOrCreateThread(projectId, threadId)
  await MessageManager.deleteMessage(room._id, messageId)
  res.status(204)
}

const _deleteUserMessage = async (req, res) => {
  const { projectId, threadId, userId, messageId } = req.params
  const room = await ThreadManager.findOrCreateThread(projectId, threadId)
  await MessageManager.deleteUserMessage(userId, room._id, messageId)
  res.status(204)
}

const _getResolvedThreadIds = async (req, res) => {
  const { projectId } = req.params
  const resolvedThreadIds = await ThreadManager.getResolvedThreadIds(projectId)
  res.json({ resolvedThreadIds })
}

const _destroyProject = async (req, res) => {
  const { projectId } = req.params
  logger.debug({ projectId }, 'destroying project')
  const rooms = await ThreadManager.findAllThreadRoomsAndGlobalThread(projectId)
  const roomIds = rooms.map(r => r._id)
  logger.debug({ projectId, roomIds }, 'deleting all messages in rooms')
  await MessageManager.deleteAllMessagesInRooms(roomIds)
  logger.debug({ projectId }, 'deleting all threads in project')
  await ThreadManager.deleteAllThreadsInProject(projectId)
  res.status(204)
}

async function _sendMessage(userId, projectId, content, clientThreadId, res) {
  if (!ObjectId.isValid(userId)) {
    const message = 'Invalid userId'
    res.status(400).setBody(message)
    return message
  }
  if (!content) {
    const message = 'No content provided'
    res.status(400).setBody(message)
    return message
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    const message = `Content too long (> ${MAX_MESSAGE_LENGTH} bytes)`
    res.status(400).setBody(message)
    return message
  }
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
  res.status(201).setBody(message)
}

async function _getMessages(clientThreadId, req, res) {
  let before, limit
  const { projectId } = req.params
  if (req.query.before) {
    before = parseInt(req.query.before, 10)
  } else {
    before = null
  }
  if (req.query.limit) {
    limit = parseInt(req.query.limit, 10)
  } else {
    limit = DEFAULT_MESSAGE_LIMIT
  }
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
  res.status(200).setBody(messages)
}

async function _duplicateCommentThreads(req, res) {
  const { projectId } = req.params
  const { threads } = req.body
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
