/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-undef,
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
const logger = require('logger-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserInfoManager = require('../User/UserInfoManager')
const UserInfoController = require('../User/UserInfoController')
const async = require('async')

module.exports = ChatController = {
  sendMessage(req, res, next) {
    const { project_id } = req.params
    const { content } = req.body
    const user_id = AuthenticationController.getLoggedInUserId(req)
    if (user_id == null) {
      const err = new Error('no logged-in user')
      return next(err)
    }
    return ChatApiHandler.sendGlobalMessage(
      project_id,
      user_id,
      content,
      function(err, message) {
        if (err != null) {
          return next(err)
        }
        return UserInfoManager.getPersonalInfo(message.user_id, function(
          err,
          user
        ) {
          if (err != null) {
            return next(err)
          }
          message.user = UserInfoController.formatPersonalInfo(user)
          EditorRealTimeController.emitToRoom(
            project_id,
            'new-chat-message',
            message
          )
          return res.send(204)
        })
      }
    )
  },

  getMessages(req, res, next) {
    const { project_id } = req.params
    const { query } = req
    logger.log({ project_id, query }, 'getting messages')
    return ChatApiHandler.getGlobalMessages(
      project_id,
      query.limit,
      query.before,
      function(err, messages) {
        if (err != null) {
          return next(err)
        }
        return ChatController._injectUserInfoIntoThreads(
          { global: { messages } },
          function(err) {
            if (err != null) {
              return next(err)
            }
            logger.log(
              { length: messages != null ? messages.length : undefined },
              'sending messages to client'
            )
            return res.json(messages)
          }
        )
      }
    )
  },

  _injectUserInfoIntoThreads(threads, callback) {
    // There will be a lot of repitition of user_ids, so first build a list
    // of unique ones to perform db look ups on, then use these to populate the
    // user fields
    let message, thread, thread_id, user_id
    if (callback == null) {
      callback = function(error, threads) {}
    }
    const user_ids = {}
    for (thread_id in threads) {
      thread = threads[thread_id]
      if (thread.resolved) {
        user_ids[thread.resolved_by_user_id] = true
      }
      for (message of Array.from(thread.messages)) {
        user_ids[message.user_id] = true
      }
    }

    const jobs = []
    const users = {}
    for (user_id in user_ids) {
      const _ = user_ids[user_id]
      ;(user_id =>
        jobs.push(cb =>
          UserInfoManager.getPersonalInfo(user_id, function(err, user) {
            if (typeof error !== 'undefined' && error !== null) {
              return cb(error)
            }
            user = UserInfoController.formatPersonalInfo(user)
            users[user_id] = user
            return cb()
          })
        ))(user_id)
    }

    return async.series(jobs, function(error) {
      if (error != null) {
        return callback(error)
      }
      for (thread_id in threads) {
        thread = threads[thread_id]
        if (thread.resolved) {
          thread.resolved_by_user = users[thread.resolved_by_user_id]
        }
        for (message of Array.from(thread.messages)) {
          message.user = users[message.user_id]
        }
      }
      return callback(null, threads)
    })
  }
}
