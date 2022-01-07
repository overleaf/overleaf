const request = require('request').defaults({
  baseUrl: 'http://localhost:3010',
})

module.exports = {
  sendGlobalMessage(projectId, userId, content, callback) {
    request.post(
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
    request.get(
      {
        url: `/project/${projectId}/messages`,
        json: true,
      },
      callback
    )
  },

  sendMessage(projectId, threadId, userId, content, callback) {
    request.post(
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
    request.get(
      {
        url: `/project/${projectId}/threads`,
        json: true,
      },
      callback
    )
  },

  resolveThread(projectId, threadId, userId, callback) {
    request.post(
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
    request.post(
      {
        url: `/project/${projectId}/thread/${threadId}/reopen`,
      },
      callback
    )
  },

  deleteThread(projectId, threadId, callback) {
    request.del(
      {
        url: `/project/${projectId}/thread/${threadId}`,
      },
      callback
    )
  },

  editMessage(projectId, threadId, messageId, content, callback) {
    request.post(
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
    request.del(
      {
        url: `/project/${projectId}/thread/${threadId}/messages/${messageId}`,
      },
      callback
    )
  },
}
