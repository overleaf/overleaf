const request = require('request').defaults({
  baseUrl: 'http://localhost:3010',
})

async function asyncRequest(options) {
  return new Promise((resolve, reject) => {
    request(options, (err, response, body) => {
      if (err) {
        reject(err)
      } else {
        resolve({ response, body })
      }
    })
  })
}

async function sendGlobalMessage(projectId, userId, content) {
  return asyncRequest({
    method: 'post',
    url: `/project/${projectId}/messages`,
    json: {
      user_id: userId,
      content,
    },
  })
}

async function getGlobalMessages(projectId) {
  return asyncRequest({
    method: 'get',
    url: `/project/${projectId}/messages`,
    json: true,
  })
}

async function sendMessage(projectId, threadId, userId, content) {
  return asyncRequest({
    method: 'post',
    url: `/project/${projectId}/thread/${threadId}/messages`,
    json: {
      user_id: userId,
      content,
    },
  })
}

async function getThreads(projectId) {
  return asyncRequest({
    method: 'get',
    url: `/project/${projectId}/threads`,
    json: true,
  })
}

async function resolveThread(projectId, threadId, userId) {
  return asyncRequest({
    method: 'post',
    url: `/project/${projectId}/thread/${threadId}/resolve`,
    json: {
      user_id: userId,
    },
  })
}

async function reopenThread(projectId, threadId) {
  return asyncRequest({
    method: 'post',
    url: `/project/${projectId}/thread/${threadId}/reopen`,
  })
}

async function deleteThread(projectId, threadId) {
  return asyncRequest({
    method: 'delete',
    url: `/project/${projectId}/thread/${threadId}`,
  })
}

async function editMessage(projectId, threadId, messageId, content) {
  return asyncRequest({
    method: 'post',
    url: `/project/${projectId}/thread/${threadId}/messages/${messageId}/edit`,
    json: {
      content,
    },
  })
}

async function editMessageWithUser(
  projectId,
  threadId,
  messageId,
  userId,
  content
) {
  return asyncRequest({
    method: 'post',
    url: `/project/${projectId}/thread/${threadId}/messages/${messageId}/edit`,
    json: {
      content,
      userId,
    },
  })
}

async function deleteMessage(projectId, threadId, messageId) {
  return asyncRequest({
    method: 'delete',
    url: `/project/${projectId}/thread/${threadId}/messages/${messageId}`,
  })
}

async function destroyProject(projectId) {
  return asyncRequest({
    method: 'delete',
    url: `/project/${projectId}`,
  })
}

module.exports = {
  sendGlobalMessage,
  getGlobalMessages,
  sendMessage,
  getThreads,
  resolveThread,
  reopenThread,
  deleteThread,
  editMessage,
  editMessageWithUser,
  deleteMessage,
  destroyProject,
}
