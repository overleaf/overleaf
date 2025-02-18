// @ts-check

const { fetchJson, fetchNothing } = require('@overleaf/fetch-utils')
const settings = require('@overleaf/settings')
const { callbackify } = require('util')

async function getThreads(projectId) {
  return await fetchJson(chatApiUrl(`/project/${projectId}/threads`))
}

async function destroyProject(projectId) {
  await fetchNothing(chatApiUrl(`/project/${projectId}`), { method: 'DELETE' })
}

async function sendGlobalMessage(projectId, userId, content) {
  const message = await fetchJson(
    chatApiUrl(`/project/${projectId}/messages`),
    {
      method: 'POST',
      json: { user_id: userId, content },
    }
  )
  return message
}

async function getGlobalMessages(projectId, limit, before) {
  const url = chatApiUrl(`/project/${projectId}/messages`)
  if (limit != null) {
    url.searchParams.set('limit', limit)
  }
  if (before != null) {
    url.searchParams.set('before', before)
  }

  return await fetchJson(url)
}

async function sendComment(projectId, threadId, userId, content) {
  const comment = await fetchJson(
    chatApiUrl(`/project/${projectId}/thread/${threadId}/messages`),
    {
      method: 'POST',
      json: { user_id: userId, content },
    }
  )
  return comment
}

async function resolveThread(projectId, threadId, userId) {
  await fetchNothing(
    chatApiUrl(`/project/${projectId}/thread/${threadId}/resolve`),
    {
      method: 'POST',
      json: { user_id: userId },
    }
  )
}

async function reopenThread(projectId, threadId) {
  await fetchNothing(
    chatApiUrl(`/project/${projectId}/thread/${threadId}/reopen`),
    { method: 'POST' }
  )
}

async function deleteThread(projectId, threadId) {
  await fetchNothing(chatApiUrl(`/project/${projectId}/thread/${threadId}`), {
    method: 'DELETE',
  })
}

async function editMessage(projectId, threadId, messageId, userId, content) {
  await fetchNothing(
    chatApiUrl(
      `/project/${projectId}/thread/${threadId}/messages/${messageId}/edit`
    ),
    {
      method: 'POST',
      json: { content, userId },
    }
  )
}

async function deleteMessage(projectId, threadId, messageId) {
  await fetchNothing(
    chatApiUrl(
      `/project/${projectId}/thread/${threadId}/messages/${messageId}`
    ),
    { method: 'DELETE' }
  )
}

async function deleteUserMessage(projectId, threadId, userId, messageId) {
  await fetchNothing(
    chatApiUrl(
      `/project/${projectId}/thread/${threadId}/user/${userId}/messages/${messageId}`
    ),
    { method: 'DELETE' }
  )
}

async function getResolvedThreadIds(projectId) {
  const body = await fetchJson(
    chatApiUrl(`/project/${projectId}/resolved-thread-ids`)
  )
  return body.resolvedThreadIds
}

async function duplicateCommentThreads(projectId, threads) {
  return await fetchJson(
    chatApiUrl(`/project/${projectId}/duplicate-comment-threads`),
    {
      method: 'POST',
      json: {
        threads,
      },
    }
  )
}

async function generateThreadData(projectId, threads) {
  return await fetchJson(
    chatApiUrl(`/project/${projectId}/generate-thread-data`),
    {
      method: 'POST',
      json: { threads },
    }
  )
}

function chatApiUrl(path) {
  return new URL(path, settings.apis.chat.internal_url)
}

module.exports = {
  getThreads: callbackify(getThreads),
  destroyProject: callbackify(destroyProject),
  sendGlobalMessage: callbackify(sendGlobalMessage),
  getGlobalMessages: callbackify(getGlobalMessages),
  sendComment: callbackify(sendComment),
  resolveThread: callbackify(resolveThread),
  reopenThread: callbackify(reopenThread),
  deleteThread: callbackify(deleteThread),
  editMessage: callbackify(editMessage),
  deleteMessage: callbackify(deleteMessage),
  deleteUserMessage: callbackify(deleteUserMessage),
  getResolvedThreadIds: callbackify(getResolvedThreadIds),
  duplicateCommentThreads: callbackify(duplicateCommentThreads),
  generateThreadData: callbackify(generateThreadData),
  promises: {
    getThreads,
    destroyProject,
    sendGlobalMessage,
    getGlobalMessages,
    sendComment,
    resolveThread,
    reopenThread,
    deleteThread,
    editMessage,
    deleteMessage,
    deleteUserMessage,
    getResolvedThreadIds,
    duplicateCommentThreads,
    generateThreadData,
  },
}
