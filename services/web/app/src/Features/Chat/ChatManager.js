const async = require('async')
const UserInfoManager = require('../User/UserInfoManager')
const UserInfoController = require('../User/UserInfoController')
const { promisify } = require('@overleaf/promise-utils')

function injectUserInfoIntoThreads(threads, callback) {
  // There will be a lot of repitition of user_ids, so first build a list
  // of unique ones to perform db look ups on, then use these to populate the
  // user fields
  let message, thread, threadId, userId
  if (callback == null) {
    callback = function () {}
  }
  const userIds = {}
  for (threadId in threads) {
    thread = threads[threadId]
    if (thread.resolved) {
      userIds[thread.resolved_by_user_id] = true
    }
    for (message of Array.from(thread.messages)) {
      userIds[message.user_id] = true
    }
  }

  const jobs = []
  const users = {}
  for (userId in userIds) {
    ;(userId =>
      jobs.push(cb =>
        UserInfoManager.getPersonalInfo(userId, function (error, user) {
          if (error != null) return cb(error)
          user = UserInfoController.formatPersonalInfo(user)
          users[userId] = user
          cb()
        })
      ))(userId)
  }

  return async.series(jobs, function (error) {
    if (error != null) {
      return callback(error)
    }
    for (threadId in threads) {
      thread = threads[threadId]
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

module.exports = {
  injectUserInfoIntoThreads,
  promises: {
    injectUserInfoIntoThreads: promisify(injectUserInfoIntoThreads),
  },
}
