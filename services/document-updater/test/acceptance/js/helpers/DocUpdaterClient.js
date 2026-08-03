let DocUpdaterClient
const Settings = require('@overleaf/settings')
const _ = require('lodash')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema
const { fetchJson, fetchNothing } = require('@overleaf/fetch-utils')
const { setTimeout } = require('node:timers/promises')

const rclientSub = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.pubsub
)
// applied ops (and errors) are published on the editor-events channel
rclientSub.subscribe('editor-events')
rclientSub.setMaxListeners(0)

function getPendingUpdateListKey() {
  const shard = _.random(0, Settings.dispatcherCount - 1)
  if (shard === 0) {
    return 'pending-updates-list'
  } else {
    return `pending-updates-list-${shard}`
  }
}

module.exports = DocUpdaterClient = {
  randomId() {
    let str = ''
    for (let i = 0; i < 24; i++) {
      str += Math.floor(Math.random() * 16).toString(16)
    }
    return str
  },

  subscribeToAppliedOps(messageHandler) {
    rclientSub.on('message', messageHandler)
  },

  // Enqueue an update for the doc-updater: push the payload (tagged with its
  // doc id) onto the per-project queue, then a bare "<proj>" marker onto the
  // dispatch list.
  async sendUpdate(projectId, docId, update) {
    await rclient.rpush(
      keys.pendingProjectUpdates({ project_id: projectId }),
      JSON.stringify({ ...update, doc: docId })
    )
    await rclient.rpush(getPendingUpdateListKey(), projectId)
  },

  async sendUpdates(projectId, docId, updates) {
    await DocUpdaterClient.preloadDoc(projectId, docId)
    for (const update of updates) {
      await DocUpdaterClient.sendUpdate(projectId, docId, update)
    }
    await DocUpdaterClient.waitForPendingUpdates(projectId, docId)
  },

  async waitForPendingUpdates(projectId, docId) {
    const maxRetries = 30
    const retryInterval = 100

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const projectLength = await rclient.llen(
        keys.pendingProjectUpdates({ project_id: projectId })
      )

      if (projectLength === 0) {
        return // Success - no pending updates
      }

      if (attempt < maxRetries - 1) {
        await setTimeout(retryInterval)
      }
    }
    throw new Error('updates still pending after maximum retries')
  },

  async getDoc(projectId, docId) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}`
    )
  },

  async getDocAndRecentOps(projectId, docId, fromVersion) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}?fromVersion=${fromVersion}`
    )
  },

  async getProjectLastUpdatedAt(projectId) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/last_updated_at`
    )
  },

  async preloadDoc(projectId, docId) {
    await DocUpdaterClient.getDoc(projectId, docId)
  },

  async peekDoc(projectId, docId) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/peek`
    )
  },

  async flushDoc(projectId, docId) {
    return await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/flush`,
      { method: 'POST' }
    )
  },

  async setDocLines(
    projectId,
    docId,
    lines,
    source,
    userId,
    undoing,
    trackChanges
  ) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}`,
      {
        method: 'POST',
        json: {
          lines,
          source,
          user_id: userId,
          undoing,
          trackChanges,
        },
      }
    )
  },

  async appendToDoc(projectId, docId, lines, source, userId, trackChanges) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/append`,
      {
        method: 'POST',
        json: {
          lines,
          source,
          user_id: userId,
          trackChanges,
        },
      }
    )
  },

  async deleteDoc(projectId, docId) {
    return await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}`,
      { method: 'DELETE' }
    )
  },

  async flushProject(projectId) {
    return await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/flush`,
      {
        method: 'POST',
      }
    )
  },

  async deleteProject(projectId) {
    return await fetchNothing(`http://127.0.0.1:3003/project/${projectId}`, {
      method: 'DELETE',
    })
  },

  async deleteProjectOnShutdown(projectId) {
    return await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}?background=true&shutdown=true`,
      {
        method: 'DELETE',
      }
    )
  },

  async flushOldProjects() {
    await fetchNothing(
      'http://127.0.0.1:3003/flush_queued_projects?min_delete_age=1'
    )
  },

  async acceptChange(projectId, docId, changeId) {
    await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/change/${changeId}/accept`,
      { method: 'POST' }
    )
  },

  async acceptChanges(projectId, docId, changeIds) {
    await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/change/accept`,
      {
        method: 'POST',
        json: { change_ids: changeIds },
      }
    )
  },

  async getComment(projectId, docId, commentId) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/comment/${commentId}`
    )
  },

  async resolveComment(projectId, docId, commentId, userId) {
    await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/comment/${commentId}/resolve`,
      { method: 'POST', json: { user_id: userId } }
    )
  },

  async reopenComment(projectId, docId, commentId, userId) {
    await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/comment/${commentId}/reopen`,
      { method: 'POST', json: { user_id: userId } }
    )
  },

  async removeComment(projectId, docId, commentId, userId) {
    await fetchNothing(
      `http://127.0.0.1:3003/project/${projectId}/doc/${docId}/comment/${commentId}`,
      { method: 'DELETE', json: { user_id: userId } }
    )
  },

  async getProjectDocs(projectId, projectStateHash) {
    return await fetchJson(
      `http://127.0.0.1:3003/project/${projectId}/doc?state=${projectStateHash}`
    )
  },

  async sendProjectUpdate(projectId, userId, updates, version, source) {
    await fetchNothing(`http://127.0.0.1:3003/project/${projectId}`, {
      method: 'POST',
      json: { userId, updates, version, source },
    })
  },
}
