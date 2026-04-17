// @ts-check

import { fetchJson, fetchNothing } from '@overleaf/fetch-utils'

import settings from '@overleaf/settings'
import { callbackify } from 'node:util'

/**
 * @param {any} projectId
 * @param {any} threadId
 */
async function getThread(projectId, threadId) {
  return await fetchJson(chatApiUrl(`/project/${projectId}/thread/${threadId}`))
}

/**
 * @param {any} projectId
 * @param {any} threadId
 * @param {any} messageId
 */
async function getThreadMessage(projectId, threadId, messageId) {
  return await fetchJson(
    chatApiUrl(`/project/${projectId}/thread/${threadId}/messages/${messageId}`)
  )
}

/**
 * @param {any} projectId
 */
async function getThreads(projectId) {
  return await fetchJson(chatApiUrl(`/project/${projectId}/threads`))
}

/**
 * @param {any} projectId
 */
async function destroyProject(projectId) {
  await fetchNothing(chatApiUrl(`/project/${projectId}`), { method: 'DELETE' })
}

/**
 * @param {any} projectId
 * @param {any} userId
 * @param {any} content
 */
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

/**
 * @param {any} projectId
 * @param {any} limit
 * @param {any} before
 */
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

/**
 * @param {any} projectId
 * @param {any} messageId
 */
async function getGlobalMessage(projectId, messageId) {
  return await fetchJson(
    chatApiUrl(`/project/${projectId}/messages/${messageId}`)
  )
}

/**
 * @param {any} projectId
 * @param {any} threadId
 * @param {any} userId
 * @param {any} content
 */
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

/**
 * @param {any} projectId
 * @param {any} threadId
 * @param {any} userId
 */
async function resolveThread(projectId, threadId, userId) {
  await fetchNothing(
    chatApiUrl(`/project/${projectId}/thread/${threadId}/resolve`),
    {
      method: 'POST',
      json: { user_id: userId },
    }
  )
}

/**
 * @param {any} projectId
 * @param {any} threadId
 */
async function reopenThread(projectId, threadId) {
  await fetchNothing(
    chatApiUrl(`/project/${projectId}/thread/${threadId}/reopen`),
    { method: 'POST' }
  )
}

/**
 * @param {any} projectId
 * @param {any} threadId
 */
async function deleteThread(projectId, threadId) {
  await fetchNothing(chatApiUrl(`/project/${projectId}/thread/${threadId}`), {
    method: 'DELETE',
  })
}

/**
 * @param {any} projectId
 * @param {any} threadId
 * @param {any} messageId
 * @param {any} userId
 * @param {any} content
 */
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

/**
 * @param {any} projectId
 * @param {any} messageId
 * @param {any} userId
 * @param {any} content
 */
async function editGlobalMessage(projectId, messageId, userId, content) {
  await fetchNothing(
    chatApiUrl(`/project/${projectId}/messages/${messageId}/edit`),
    {
      method: 'POST',
      json: { content, userId },
    }
  )
}

/**
 * @param {any} projectId
 * @param {any} threadId
 * @param {any} messageId
 */
async function deleteMessage(projectId, threadId, messageId) {
  await fetchNothing(
    chatApiUrl(
      `/project/${projectId}/thread/${threadId}/messages/${messageId}`
    ),
    { method: 'DELETE' }
  )
}

/**
 * @param {any} projectId
 * @param {any} threadId
 * @param {any} userId
 * @param {any} messageId
 */
async function deleteUserMessage(projectId, threadId, userId, messageId) {
  await fetchNothing(
    chatApiUrl(
      `/project/${projectId}/thread/${threadId}/user/${userId}/messages/${messageId}`
    ),
    { method: 'DELETE' }
  )
}

/**
 * @param {any} projectId
 * @param {any} messageId
 */
async function deleteGlobalMessage(projectId, messageId) {
  await fetchNothing(
    chatApiUrl(`/project/${projectId}/messages/${messageId}`),
    { method: 'DELETE' }
  )
}

/**
 * @param {any} projectId
 */
async function getResolvedThreadIds(projectId) {
  const body = await fetchJson(
    chatApiUrl(`/project/${projectId}/resolved-thread-ids`)
  )
  return body.resolvedThreadIds
}

/**
 * @param {any} projectId
 * @param {any} threads
 */
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

/**
 * @param {any} projectId
 * @param {any} threads
 */
async function generateThreadData(projectId, threads) {
  return await fetchJson(
    chatApiUrl(`/project/${projectId}/generate-thread-data`),
    {
      method: 'POST',
      json: { threads },
    }
  )
}

/**
 * @param {string} sourceProjectId
 * @param {string} targetProjectId
 * @return {Promise<void>}
 */
async function cloneCommentThreads(sourceProjectId, targetProjectId) {
  await fetchNothing(
    chatApiUrl(`/project/${sourceProjectId}/clone-comment-threads`),
    {
      method: 'POST',
      json: { targetProjectId },
    }
  )
}

/**
 * @param {any} path
 */
function chatApiUrl(path) {
  return new URL(path, settings.apis.chat.internal_url)
}

export default {
  getThread: callbackify(getThread),
  getThreadMessage: callbackify(getThreadMessage),
  getThreads: callbackify(getThreads),
  destroyProject: callbackify(destroyProject),
  sendGlobalMessage: callbackify(sendGlobalMessage),
  getGlobalMessages: callbackify(getGlobalMessages),
  getGlobalMessage: callbackify(getGlobalMessage),
  sendComment: callbackify(sendComment),
  resolveThread: callbackify(resolveThread),
  reopenThread: callbackify(reopenThread),
  deleteThread: callbackify(deleteThread),
  editMessage: callbackify(editMessage),
  editGlobalMessage: callbackify(editGlobalMessage),
  deleteMessage: callbackify(deleteMessage),
  deleteUserMessage: callbackify(deleteUserMessage),
  deleteGlobalMessage: callbackify(deleteGlobalMessage),
  getResolvedThreadIds: callbackify(getResolvedThreadIds),
  duplicateCommentThreads: callbackify(duplicateCommentThreads),
  generateThreadData: callbackify(generateThreadData),
  promises: {
    getThread,
    getThreadMessage,
    getThreads,
    destroyProject,
    sendGlobalMessage,
    getGlobalMessages,
    getGlobalMessage,
    sendComment,
    resolveThread,
    reopenThread,
    deleteThread,
    editMessage,
    editGlobalMessage,
    deleteMessage,
    deleteUserMessage,
    deleteGlobalMessage,
    getResolvedThreadIds,
    duplicateCommentThreads,
    generateThreadData,
    cloneCommentThreads,
  },
}
