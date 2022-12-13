import logger from '@overleaf/logger'
import * as MessageManager from './MessageManager.js'
import * as MessageFormatter from './MessageFormatter.js'
import * as ThreadManager from '../Threads/ThreadManager.js'
import { ObjectId } from '../../mongodb.js'
import { expressify } from '../../util/promises.js'

const DEFAULT_MESSAGE_LIMIT = 50
const MAX_MESSAGE_LENGTH = 10 * 1024 // 10kb, about 1,500 words

export const getGlobalMessages = expressify(async (req, res) => {
  await _getMessages(ThreadManager.GLOBAL_THREAD, req, res)
})

export const sendGlobalMessage = expressify(async (req, res) => {
  await _sendMessage(ThreadManager.GLOBAL_THREAD, req, res)
})

export const sendThreadMessage = expressify(async (req, res) => {
  await _sendMessage(req.params.threadId, req, res)
})

export const getAllThreads = expressify(async (req, res) => {
  const { projectId } = req.params
  logger.debug({ projectId }, 'getting all threads')
  const rooms = await ThreadManager.findAllThreadRooms(projectId)
  const roomIds = rooms.map(r => r._id)
  const messages = await MessageManager.findAllMessagesInRooms(roomIds)
  const threads = MessageFormatter.groupMessagesByThreads(rooms, messages)
  res.json(threads)
})

export const resolveThread = expressify(async (req, res) => {
  const { projectId, threadId } = req.params
  const { user_id: userId } = req.body
  logger.debug({ userId, projectId, threadId }, 'marking thread as resolved')
  await ThreadManager.resolveThread(projectId, threadId, userId)
  res.sendStatus(204)
})

export const reopenThread = expressify(async (req, res) => {
  const { projectId, threadId } = req.params
  logger.debug({ projectId, threadId }, 'reopening thread')
  await ThreadManager.reopenThread(projectId, threadId)
  res.sendStatus(204)
})

export const deleteThread = expressify(async (req, res) => {
  const { projectId, threadId } = req.params
  logger.debug({ projectId, threadId }, 'deleting thread')
  const roomId = await ThreadManager.deleteThread(projectId, threadId)
  await MessageManager.deleteAllMessagesInRoom(roomId)
  res.sendStatus(204)
})

export const editMessage = expressify(async (req, res) => {
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
    return res.sendStatus(404)
  }
  res.sendStatus(204)
})

export const deleteMessage = expressify(async (req, res) => {
  const { projectId, threadId, messageId } = req.params
  logger.debug({ projectId, threadId, messageId }, 'deleting message')
  const room = await ThreadManager.findOrCreateThread(projectId, threadId)
  await MessageManager.deleteMessage(room._id, messageId)
  res.sendStatus(204)
})

export const destroyProject = expressify(async (req, res) => {
  const { projectId } = req.params
  logger.debug({ projectId }, 'destroying project')
  const rooms = await ThreadManager.findAllThreadRoomsAndGlobalThread(projectId)
  const roomIds = rooms.map(r => r._id)
  logger.debug({ projectId, roomIds }, 'deleting all messages in rooms')
  await MessageManager.deleteAllMessagesInRooms(roomIds)
  logger.debug({ projectId }, 'deleting all threads in project')
  await ThreadManager.deleteAllThreadsInProject(projectId)
  res.sendStatus(204)
})

async function _sendMessage(clientThreadId, req, res) {
  const { user_id: userId, content } = req.body
  const { projectId } = req.params
  if (!ObjectId.isValid(userId)) {
    return res.status(400).send('Invalid userId')
  }
  if (!content) {
    return res.status(400).send('No content provided')
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return res
      .status(400)
      .send(`Content too long (> ${MAX_MESSAGE_LENGTH} bytes)`)
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
  res.status(201).send(message)
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
  res.status(200).send(messages)
}
