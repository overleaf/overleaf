const logger = require('@overleaf/logger')
const MessageManager = require('./MessageManager')
const MessageFormatter = require('./MessageFormatter')
const ThreadManager = require('../Threads/ThreadManager')
const { ObjectId } = require('../../mongodb')

const DEFAULT_MESSAGE_LIMIT = 50
const MAX_MESSAGE_LENGTH = 10 * 1024 // 10kb, about 1,500 words

function getGlobalMessages(req, res, next) {
  _getMessages(ThreadManager.GLOBAL_THREAD, req, res, next)
}

function sendGlobalMessage(req, res, next) {
  _sendMessage(ThreadManager.GLOBAL_THREAD, req, res, next)
}

function sendThreadMessage(req, res, next) {
  _sendMessage(req.params.threadId, req, res, next)
}

function getAllThreads(req, res, next) {
  const { projectId } = req.params
  logger.log({ projectId }, 'getting all threads')
  ThreadManager.findAllThreadRooms(projectId, function (error, rooms) {
    if (error) {
      return next(error)
    }
    const roomIds = rooms.map(r => r._id)
    MessageManager.findAllMessagesInRooms(roomIds, function (error, messages) {
      if (error) {
        return next(error)
      }
      const threads = MessageFormatter.groupMessagesByThreads(rooms, messages)
      res.json(threads)
    })
  })
}

function resolveThread(req, res, next) {
  const { projectId, threadId } = req.params
  const { user_id: userId } = req.body
  logger.log({ userId, projectId, threadId }, 'marking thread as resolved')
  ThreadManager.resolveThread(projectId, threadId, userId, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

function reopenThread(req, res, next) {
  const { projectId, threadId } = req.params
  logger.log({ projectId, threadId }, 'reopening thread')
  ThreadManager.reopenThread(projectId, threadId, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

function deleteThread(req, res, next) {
  const { projectId, threadId } = req.params
  logger.log({ projectId, threadId }, 'deleting thread')
  ThreadManager.deleteThread(projectId, threadId, function (error, roomId) {
    if (error) {
      return next(error)
    }
    MessageManager.deleteAllMessagesInRoom(roomId, function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(204)
    })
  })
}

function editMessage(req, res, next) {
  const { content } = req.body
  const { projectId, threadId, messageId } = req.params
  logger.log({ projectId, threadId, messageId, content }, 'editing message')
  ThreadManager.findOrCreateThread(projectId, threadId, function (error, room) {
    if (error) {
      return next(error)
    }
    MessageManager.updateMessage(
      room._id,
      messageId,
      content,
      Date.now(),
      function (error) {
        if (error) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  })
}

function deleteMessage(req, res, next) {
  const { projectId, threadId, messageId } = req.params
  logger.log({ projectId, threadId, messageId }, 'deleting message')
  ThreadManager.findOrCreateThread(projectId, threadId, function (error, room) {
    if (error) {
      return next(error)
    }
    MessageManager.deleteMessage(
      room._id,
      messageId,
      function (error, message) {
        if (error) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  })
}

function _sendMessage(clientThreadId, req, res, next) {
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
  ThreadManager.findOrCreateThread(
    projectId,
    clientThreadId,
    function (error, thread) {
      if (error) {
        return next(error)
      }
      MessageManager.createMessage(
        thread._id,
        userId,
        content,
        Date.now(),
        function (error, message) {
          if (error) {
            return next(error)
          }
          message = MessageFormatter.formatMessageForClientSide(message)
          message.room_id = projectId
          res.status(201).send(message)
        }
      )
    }
  )
}

function _getMessages(clientThreadId, req, res, next) {
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
  ThreadManager.findOrCreateThread(
    projectId,
    clientThreadId,
    function (error, thread) {
      if (error) {
        return next(error)
      }
      const threadObjectId = thread._id
      logger.log(
        { limit, before, projectId, clientThreadId, threadObjectId },
        'found or created thread'
      )
      MessageManager.getMessages(
        threadObjectId,
        limit,
        before,
        function (error, messages) {
          if (error) {
            return next(error)
          }
          messages = MessageFormatter.formatMessagesForClientSide(messages)
          logger.log({ projectId, messages }, 'got messages')
          res.status(200).send(messages)
        }
      )
    }
  )
}

module.exports = {
  getGlobalMessages,
  sendGlobalMessage,
  sendThreadMessage,
  getAllThreads,
  resolveThread,
  reopenThread,
  deleteThread,
  editMessage,
  deleteMessage,
}
