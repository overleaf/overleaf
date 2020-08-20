/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MessageHttpController
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
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
      req.params.thread_id,
      req,
      res,
      next
    )
  },

  getAllThreads(req, res, next) {
    const { project_id } = req.params
    logger.log({ project_id }, 'getting all threads')
    return ThreadManager.findAllThreadRooms(project_id, function (
      error,
      rooms
    ) {
      if (error != null) {
        return next(error)
      }
      const room_ids = rooms.map((r) => r._id)
      return MessageManager.findAllMessagesInRooms(room_ids, function (
        error,
        messages
      ) {
        if (error != null) {
          return next(error)
        }
        const threads = MessageFormatter.groupMessagesByThreads(rooms, messages)
        return res.json(threads)
      })
    })
  },

  resolveThread(req, res, next) {
    const { project_id, thread_id } = req.params
    const { user_id } = req.body
    logger.log({ user_id, project_id, thread_id }, 'marking thread as resolved')
    return ThreadManager.resolveThread(
      project_id,
      thread_id,
      user_id,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  }, // No content

  reopenThread(req, res, next) {
    const { project_id, thread_id } = req.params
    logger.log({ project_id, thread_id }, 'reopening thread')
    return ThreadManager.reopenThread(project_id, thread_id, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  }, // No content

  deleteThread(req, res, next) {
    const { project_id, thread_id } = req.params
    logger.log({ project_id, thread_id }, 'deleting thread')
    return ThreadManager.deleteThread(project_id, thread_id, function (
      error,
      room_id
    ) {
      if (error != null) {
        return next(error)
      }
      return MessageManager.deleteAllMessagesInRoom(room_id, function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      })
    })
  }, // No content

  editMessage(req, res, next) {
    const { content } = req != null ? req.body : undefined
    const { project_id, thread_id, message_id } = req.params
    logger.log(
      { project_id, thread_id, message_id, content },
      'editing message'
    )
    return ThreadManager.findOrCreateThread(project_id, thread_id, function (
      error,
      room
    ) {
      if (error != null) {
        return next(error)
      }
      return MessageManager.updateMessage(
        room._id,
        message_id,
        content,
        Date.now(),
        function (error) {
          if (error != null) {
            return next(error)
          }
          return res.sendStatus(204)
        }
      )
    })
  },

  deleteMessage(req, res, next) {
    const { project_id, thread_id, message_id } = req.params
    logger.log({ project_id, thread_id, message_id }, 'deleting message')
    return ThreadManager.findOrCreateThread(project_id, thread_id, function (
      error,
      room
    ) {
      if (error != null) {
        return next(error)
      }
      return MessageManager.deleteMessage(room._id, message_id, function (
        error,
        message
      ) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      })
    })
  },

  _sendMessage(client_thread_id, req, res, next) {
    const { user_id, content } = req != null ? req.body : undefined
    const { project_id } = req.params
    if (!ObjectId.isValid(user_id)) {
      return res.status(400).send('Invalid user_id')
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
      { client_thread_id, project_id, user_id, content },
      'new message received'
    )
    return ThreadManager.findOrCreateThread(
      project_id,
      client_thread_id,
      function (error, thread) {
        if (error != null) {
          return next(error)
        }
        return MessageManager.createMessage(
          thread._id,
          user_id,
          content,
          Date.now(),
          function (error, message) {
            if (error != null) {
              return next(error)
            }
            message = MessageFormatter.formatMessageForClientSide(message)
            message.room_id = project_id
            return res.status(201).send(message)
          }
        )
      }
    )
  },

  _getMessages(client_thread_id, req, res, next) {
    let before, limit
    const { project_id } = req.params
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
      { limit, before, project_id, client_thread_id },
      'get message request received'
    )
    return ThreadManager.findOrCreateThread(
      project_id,
      client_thread_id,
      function (error, thread) {
        if (error != null) {
          return next(error)
        }
        const thread_object_id = thread._id
        logger.log(
          { limit, before, project_id, client_thread_id, thread_object_id },
          'found or created thread'
        )
        return MessageManager.getMessages(
          thread_object_id,
          limit,
          before,
          function (error, messages) {
            if (error != null) {
              return next(error)
            }
            messages = MessageFormatter.formatMessagesForClientSide(messages)
            logger.log({ project_id, messages }, 'got messages')
            return res.status(200).send(messages)
          }
        )
      }
    )
  }
}
