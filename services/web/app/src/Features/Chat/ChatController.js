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
}
