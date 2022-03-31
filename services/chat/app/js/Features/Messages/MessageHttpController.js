const logger = require('@overleaf/logger')
const MessageManager = require('./MessageManager')
const MessageFormatter = require('./MessageFormatter')
const ThreadManager = require('../Threads/ThreadManager')
const { ObjectId } = require('../../mongodb')
const { expressify } = require('../../util/promises')

const DEFAULT_MESSAGE_LIMIT = 50
const MAX_MESSAGE_LENGTH = 10 * 1024 // 10kb, about 1,500 words

async function getGlobalMessages(req, res) {
  await _getMessages(ThreadManager.GLOBAL_THREAD, req, res)
}

async function sendGlobalMessage(req, res) {
  await _sendMessage(ThreadManager.GLOBAL_THREAD, req, res)
}

async function sendThreadMessage(req, res) {
  await _sendMessage(req.params.threadId, req, res)
}

async function getAllThreads(req, res) {
  const { projectId } = req.params
  logger.log({ projectId }, 'getting all threads')
  const rooms = await ThreadManager.findAllThreadRooms(projectId)
  const roomIds = rooms.map(r => r._id)
  const messages = await MessageManager.findAllMessagesInRooms(roomIds)
  const threads = MessageFormatter.groupMessagesByThreads(rooms, messages)
  res.json(threads)
}

async function resolveThread(req, res) {
  const { projectId, threadId } = req.params
  const { user_id: userId } = req.body
  logger.log({ userId, projectId, threadId }, 'marking thread as resolved')
  await ThreadManager.resolveThread(projectId, threadId, userId)
  res.sendStatus(204)
}

async function reopenThread(req, res) {
  const { projectId, threadId } = req.params
  logger.log({ projectId, threadId }, 'reopening thread')
  await ThreadManager.reopenThread(projectId, threadId)
  res.sendStatus(204)
}

async function deleteThread(req, res) {
  const { projectId, threadId } = req.params
  logger.log({ projectId, threadId }, 'deleting thread')
  const roomId = await ThreadManager.deleteThread(projectId, threadId)
  await MessageManager.deleteAllMessagesInRoom(roomId)
  res.sendStatus(204)
}

async function editMessage(req, res) {
  const { content, userId } = req.body
  const { projectId, threadId, messageId } = req.params
  logger.log({ projectId, threadId, messageId, content }, 'editing message')
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
}

async function deleteMessage(req, res) {
  const { projectId, threadId, messageId } = req.params
  logger.log({ projectId, threadId, messageId }, 'deleting message')
  const room = await ThreadManager.findOrCreateThread(projectId, threadId)
  await MessageManager.deleteMessage(room._id, messageId)
  res.sendStatus(204)
}

async function destroyProject(req, res) {
  const { projectId } = req.params
  logger.log({ projectId }, 'destroying project')
  const rooms = await ThreadManager.findAllThreadRoomsAndGlobalThread(projectId)
  const roomIds = rooms.map(r => r._id)
  logger.log({ projectId, roomIds }, 'deleting all messages in rooms')
  await MessageManager.deleteAllMessagesInRooms(roomIds)
  logger.log({ projectId }, 'deleting all threads in project')
  await ThreadManager.deleteAllThreadsInProject(projectId)
  res.sendStatus(204)
}

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
  logger.log(
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
  logger.log(
    { limit, before, projectId, clientThreadId },
    'get message request received'
  )
  const thread = await ThreadManager.findOrCreateThread(
    projectId,
    clientThreadId
  )
  const threadObjectId = thread._id
  logger.log(
    { limit, before, projectId, clientThreadId, threadObjectId },
    'found or created thread'
  )
  let messages = await MessageManager.getMessages(threadObjectId, limit, before)
  messages = MessageFormatter.formatMessagesForClientSide(messages)
  logger.log({ projectId, messages }, 'got messages')
  res.status(200).send(messages)
}

module.exports = {
  getGlobalMessages: expressify(getGlobalMessages),
  sendGlobalMessage: expressify(sendGlobalMessage),
  sendThreadMessage: expressify(sendThreadMessage),
  getAllThreads: expressify(getAllThreads),
  resolveThread: expressify(resolveThread),
  reopenThread: expressify(reopenThread),
  deleteThread: expressify(deleteThread),
  editMessage: expressify(editMessage),
  deleteMessage: expressify(deleteMessage),
  destroyProject: expressify(destroyProject),
}
