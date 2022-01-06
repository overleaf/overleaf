// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MessageHttpController
const logger = require('@overleaf/logger')
const MessageManager = require('./MessageManager')
const MessageFormatter = require('./MessageFormatter')
const ThreadManager = require('../Threads/ThreadManager')
const { ObjectId } = require('../../mongodb')

module.exports = MessageHttpController = {
  DEFAULT_MESSAGE_LIMIT: 50,
  MAX_MESSAGE_LENGTH: 10 * 1024, // 10kb, about 1,500 words

  getGlobalMessages(req, res, next) {
    return MessageHttpController._getMessages(
      ThreadManager.GLOBAL_THREAD,
      req,
      res,
      next
    )
  },

  sendGlobalMessage(req, res, next) {
    return MessageHttpController._sendMessage(
      ThreadManager.GLOBAL_THREAD,
      req,
      res,
      next
    )
  },

  sendThreadMessage(req, res, next) {
    return MessageHttpController._sendMessage(
      req.params.threadId,
      req,
      res,
      next
    )
  },

  getAllThreads(req, res, next) {
    const { projectId } = req.params
    logger.log({ projectId }, 'getting all threads')
    return ThreadManager.findAllThreadRooms(projectId, function (error, rooms) {
      if (error != null) {
        return next(error)
      }
      const roomIds = rooms.map(r => r._id)
      return MessageManager.findAllMessagesInRooms(
        roomIds,
        function (error, messages) {
          if (error != null) {
            return next(error)
          }
          const threads = MessageFormatter.groupMessagesByThreads(
            rooms,
            messages
          )
          return res.json(threads)
        }
      )
    })
  },

  resolveThread(req, res, next) {
    const { projectId, threadId } = req.params
    const { user_id: userId } = req.body
    logger.log({ userId, projectId, threadId }, 'marking thread as resolved')
    return ThreadManager.resolveThread(
      projectId,
      threadId,
      userId,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  }, // No content

  reopenThread(req, res, next) {
    const { projectId, threadId } = req.params
    logger.log({ projectId, threadId }, 'reopening thread')
    return ThreadManager.reopenThread(projectId, threadId, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  }, // No content

  deleteThread(req, res, next) {
    const { projectId, threadId } = req.params
    logger.log({ projectId, threadId }, 'deleting thread')
    return ThreadManager.deleteThread(
      projectId,
      threadId,
      function (error, roomId) {
        if (error != null) {
          return next(error)
        }
        return MessageManager.deleteAllMessagesInRoom(roomId, function (error) {
          if (error != null) {
            return next(error)
          }
          return res.sendStatus(204)
        })
      }
    )
  }, // No content

  editMessage(req, res, next) {
    const { content } = req != null ? req.body : undefined
    const { projectId, threadId, messageId } = req.params
    logger.log({ projectId, threadId, messageId, content }, 'editing message')
    return ThreadManager.findOrCreateThread(
      projectId,
      threadId,
      function (error, room) {
        if (error != null) {
          return next(error)
        }
        return MessageManager.updateMessage(
          room._id,
          messageId,
          content,
          Date.now(),
          function (error) {
            if (error != null) {
              return next(error)
            }
            return res.sendStatus(204)
          }
        )
      }
    )
  },

  deleteMessage(req, res, next) {
    const { projectId, threadId, messageId } = req.params
    logger.log({ projectId, threadId, messageId }, 'deleting message')
    return ThreadManager.findOrCreateThread(
      projectId,
      threadId,
      function (error, room) {
        if (error != null) {
          return next(error)
        }
        return MessageManager.deleteMessage(
          room._id,
          messageId,
          function (error, message) {
            if (error != null) {
              return next(error)
            }
            return res.sendStatus(204)
          }
        )
      }
    )
  },

  _sendMessage(clientThreadId, req, res, next) {
    const { user_id: userId, content } = req != null ? req.body : undefined
    const { projectId } = req.params
    if (!ObjectId.isValid(userId)) {
      return res.status(400).send('Invalid userId')
    }
    if (content == null) {
      return res.status(400).send('No content provided')
    }
    if (content.length > this.MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .send(`Content too long (> ${this.MAX_MESSAGE_LENGTH} bytes)`)
    }
    logger.log(
      { clientThreadId, projectId, userId, content },
      'new message received'
    )
    return ThreadManager.findOrCreateThread(
      projectId,
      clientThreadId,
      function (error, thread) {
        if (error != null) {
          return next(error)
        }
        return MessageManager.createMessage(
          thread._id,
          userId,
          content,
          Date.now(),
          function (error, message) {
            if (error != null) {
              return next(error)
            }
            message = MessageFormatter.formatMessageForClientSide(message)
            message.room_id = projectId
            return res.status(201).send(message)
          }
        )
      }
    )
  },

  _getMessages(clientThreadId, req, res, next) {
    let before, limit
    const { projectId } = req.params
    if ((req.query != null ? req.query.before : undefined) != null) {
      before = parseInt(req.query.before, 10)
    } else {
      before = null
    }
    if ((req.query != null ? req.query.limit : undefined) != null) {
      limit = parseInt(req.query.limit, 10)
    } else {
      limit = MessageHttpController.DEFAULT_MESSAGE_LIMIT
    }
    logger.log(
      { limit, before, projectId, clientThreadId },
      'get message request received'
    )
    return ThreadManager.findOrCreateThread(
      projectId,
      clientThreadId,
      function (error, thread) {
        if (error != null) {
          return next(error)
        }
        const threadObjectId = thread._id
        logger.log(
          { limit, before, projectId, clientThreadId, threadObjectId },
          'found or created thread'
        )
        return MessageManager.getMessages(
          threadObjectId,
          limit,
          before,
          function (error, messages) {
            if (error != null) {
              return next(error)
            }
            messages = MessageFormatter.formatMessagesForClientSide(messages)
            logger.log({ projectId, messages }, 'got messages')
            return res.status(200).send(messages)
          }
        )
      }
    )
  },
}
