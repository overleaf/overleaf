// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const request = require('request').defaults({
  baseUrl: 'http://localhost:3010',
})

module.exports = {
  sendGlobalMessage(projectId, userId, content, callback) {
    return request.post(
      {
        url: `/project/${projectId}/messages`,
        json: {
          user_id: userId,
          content,
        },
      },
      callback
    )
  },

  getGlobalMessages(projectId, callback) {
    return request.get(
      {
        url: `/project/${projectId}/messages`,
        json: true,
      },
      callback
    )
  },

  sendMessage(projectId, threadId, userId, content, callback) {
    return request.post(
      {
        url: `/project/${projectId}/thread/${threadId}/messages`,
        json: {
          user_id: userId,
          content,
        },
      },
      callback
    )
  },

  getThreads(projectId, callback) {
    return request.get(
      {
        url: `/project/${projectId}/threads`,
        json: true,
      },
      callback
    )
  },

  resolveThread(projectId, threadId, userId, callback) {
    return request.post(
      {
        url: `/project/${projectId}/thread/${threadId}/resolve`,
        json: {
          user_id: userId,
        },
      },
      callback
    )
  },

  reopenThread(projectId, threadId, callback) {
    return request.post(
      {
        url: `/project/${projectId}/thread/${threadId}/reopen`,
      },
      callback
    )
  },

  deleteThread(projectId, threadId, callback) {
    return request.del(
      {
        url: `/project/${projectId}/thread/${threadId}`,
      },
      callback
    )
  },

  editMessage(projectId, threadId, messageId, content, callback) {
    return request.post(
      {
        url: `/project/${projectId}/thread/${threadId}/messages/${messageId}/edit`,
        json: {
          content,
        },
      },
      callback
    )
  },

  deleteMessage(projectId, threadId, messageId, callback) {
    return request.del(
      {
        url: `/project/${projectId}/thread/${threadId}/messages/${messageId}`,
      },
      callback
    )
  },
}
