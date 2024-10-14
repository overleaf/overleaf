/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ChatController
const ChatApiHandler = require('./ChatApiHandler')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const SessionManager = require('../Authentication/SessionManager')
const UserInfoManager = require('../User/UserInfoManager')
const UserInfoController = require('../User/UserInfoController')
const ChatManager = require('./ChatManager')
const logger = require('@overleaf/logger')

module.exports = ChatController = {
  sendMessage(req, res, next) {
    const { project_id: projectId } = req.params
    const { content, client_id: clientId } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (userId == null) {
      const err = new Error('no logged-in user')
      return next(err)
    }
    return ChatApiHandler.sendGlobalMessage(
      projectId,
      userId,
      content,
      function (err, message) {
        if (err != null) {
          return next(err)
        }
        return UserInfoManager.getPersonalInfo(
          message.user_id,
          function (err, user) {
            if (err != null) {
              return next(err)
            }
            message.user = UserInfoController.formatPersonalInfo(user)
            message.clientId = clientId
            EditorRealTimeController.emitToRoom(
              projectId,
              'new-chat-message',
              message
            )
            return res.sendStatus(204)
          }
        )
      }
    )
  },

  getMessages(req, res, next) {
    const { project_id: projectId } = req.params
    const { query } = req
    return ChatApiHandler.getGlobalMessages(
      projectId,
      query.limit,
      query.before,
      function (err, messages) {
        if (err != null) {
          return next(err)
        }
        return ChatManager.injectUserInfoIntoThreads(
          { global: { messages } },
          function (err) {
            if (err != null) {
              return next(err)
            }
            return res.json(messages)
          }
        )
      }
    )
  },

  sendComment(req, res, next) {
    const { project_id: projectId, thread_id: threadId } = req.params
    const { content, client_id: clientId } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (userId == null) {
      const err = new Error('no logged-in user')
      return next(err)
    }
    return ChatApiHandler.sendComment(
      projectId,
      threadId,
      userId,
      content,
      function (err, message) {
        if (err != null) {
          return next(err)
        }
        return UserInfoManager.getPersonalInfo(
          message.user_id,
          function (err, user) {
            if (err != null) {
              return next(err)
            }
            message.user = UserInfoController.formatPersonalInfo(user)
            message.clientId = clientId
            EditorRealTimeController.emitToRoom(
              projectId,
              'new-comment',
              threadId,
              message
            )
            return res.sendStatus(204)
          }
        )
      }
    )
  },

  editMessage(req, res, next) {
    const { project_id: projectId, thread_id: threadId, message_id: messageId } = req.params
    const { content, client_id: clientId } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (userId == null) {
      const err = new Error('no logged-in user')
      return next(err)
    }
    return ChatApiHandler.editMessage(
      projectId,
      threadId,
      messageId,
      userId,
      content,
      function (err) {
        if (err != null) {
          return next(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'edit-message',
          threadId,
          messageId,
          content
        )
        return res.sendStatus(204)
      }
    )
  },

  deleteMessage(req, res, next) {
    const { project_id: projectId, thread_id: threadId, message_id: messageId } = req.params
    const { content, client_id: clientId } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (userId == null) {
      const err = new Error('no logged-in user')
      return next(err)
    }
    return ChatApiHandler.deleteMessage(
      projectId,
      threadId,
      messageId,
      function (err) {
        if (err != null) {
          return next(err)
        }
        return res.sendStatus(204)
      }
    )
  },

  getThreads(req, res, next) {
    const { project_id: projectId } = req.params
    const { query } = req
    return ChatApiHandler.getThreads(
      projectId,
      query.limit,
      query.before,
      function (err, threads) {
        if (err != null) {
          return next(err)
        }
        return ChatManager.injectUserInfoIntoThreads(
          threads,
          function (err) {
            if (err != null) {
              return next(err)
            }
            return res.json(threads)
          }
        )
      }
    )
  },

  resolveThread(req, res, next) {
    const { project_id: projectId, thread_id: threadId } = req.params
    const { client_id: clientId } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    if (userId == null) {
      const err = new Error('no logged-in user')
      return next(err)
    }
    return ChatApiHandler.resolveThread(
      projectId,
      threadId,
      userId,
      function (err) {
        if (err != null) {
          return next(err)
        }
        return res.sendStatus(204)
      }
    )
  },
}
