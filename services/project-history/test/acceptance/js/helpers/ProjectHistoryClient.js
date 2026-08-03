import { expect } from 'chai'
import Settings from '@overleaf/settings'
import RedisWrapper from '@overleaf/redis-wrapper'
import { db, ObjectId } from '../../../../app/js/mongodb.js'
import {
  fetchJson,
  fetchJsonWithResponse,
  fetchNothing,
  fetchStringWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'

const rclient = RedisWrapper.createClient(Settings.redis.project_history)
const Keys = Settings.redis.project_history.key_schema

export function resetDatabase(callback) {
  rclient.flushdb(callback)
}

export async function initializeProject(historyId) {
  const response = await fetchJsonWithResponse(
    'http://127.0.0.1:3054/project',
    {
      method: 'POST',
      json: { historyId },
    }
  )
  expect(response.response.status).to.equal(200)
  return response.json.project
}

export async function flushProject(projectId, options = {}) {
  const url = new URL(`http://127.0.0.1:3054/project/${projectId}/flush`)
  if (options.bisect) {
    url.searchParams.set('bisect', 'true')
  }
  try {
    const response = await fetchNothing(url.toString(), { method: 'POST' })
    if (!options.allowErrors) {
      expect(response.status).to.equal(204)
    }
    return { statusCode: response.status }
  } catch (error) {
    if (options.allowErrors && error instanceof RequestFailedError) {
      return { statusCode: error.response.status }
    }
    throw error
  }
}

export async function getSummarizedUpdates(projectId, query) {
  const url = new URL(`http://127.0.0.1:3054/project/${projectId}/updates`)
  Object.keys(query).forEach(key => {
    url.searchParams.set(key, query[key])
  })

  return await fetchJson(url.toString())
}

export async function getDiff(projectId, pathname, from, to) {
  const url = new URL(`http://127.0.0.1:3054/project/${projectId}/diff`)
  url.searchParams.set('pathname', pathname)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)

  return await fetchJson(url.toString())
}

export async function getFileTreeDiff(projectId, from, to) {
  const url = new URL(
    `http://127.0.0.1:3054/project/${projectId}/filetree/diff`
  )
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)

  try {
    const { response, json } = await fetchJsonWithResponse(url.toString())
    return { diff: json, statusCode: response.status }
  } catch (error) {
    if (error instanceof RequestFailedError) {
      return { diff: null, statusCode: error.response.status }
    }
    throw error
  }
}

export async function getChangesInChunkSince(projectId, since, options = {}) {
  const url = new URL(
    `http://127.0.0.1:3054/project/${projectId}/changes-in-chunk`
  )
  url.searchParams.set('since', since)

  try {
    const { response, json } = await fetchJsonWithResponse(url.toString())
    return { body: json, statusCode: response.status }
  } catch (error) {
    if (options.allowErrors && error instanceof RequestFailedError) {
      return { body: null, statusCode: error.response.status }
    }
    throw error
  }
}

export async function getLatestSnapshot(projectId) {
  return await fetchJson(`http://127.0.0.1:3054/project/${projectId}/snapshot`)
}

export async function getSnapshot(projectId, pathname, version, options = {}) {
  const url = `http://127.0.0.1:3054/project/${projectId}/version/${version}/${encodeURIComponent(
    pathname
  )}`

  try {
    const { response, body } = await fetchStringWithResponse(url)
    if (!options.allowErrors) {
      expect(response.status).to.equal(200)
    }
    return { body, statusCode: response.status }
  } catch (error) {
    if (options.allowErrors && error instanceof RequestFailedError) {
      return { body: null, statusCode: error.response.status }
    }
    throw error
  }
}

export async function pushRawUpdate(projectId, update) {
  await rclient.rpush(
    Keys.projectHistoryOps({ project_id: projectId }),
    JSON.stringify(update)
  )
}

export async function setFirstOpTimestamp(projectId, timestamp) {
  await rclient.set(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId }),
    timestamp
  )
}

export async function getFirstOpTimestamp(projectId) {
  return await rclient.get(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  )
}

export async function clearFirstOpTimestamp(projectId) {
  await rclient.del(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId })
  )
}

export function getQueueLength(projectId, callback) {
  rclient.llen(Keys.projectHistoryOps({ project_id: projectId }), callback)
}

export async function resyncHistory(projectId) {
  const response = await fetchNothing(
    `http://127.0.0.1:3054/project/${projectId}/resync`,
    {
      method: 'POST',
      json: { origin: { kind: 'test-origin' } },
    }
  )
  expect(response.status).to.equal(204)
}

export async function hardResyncHistory(
  projectId,
  { recoverCorruptedFiles } = {}
) {
  const params = new URLSearchParams({ force: 'true' })
  if (recoverCorruptedFiles) {
    params.set('recoverCorruptedFiles', 'true')
  }
  const response = await fetchNothing(
    `http://127.0.0.1:3054/project/${projectId}/resync?${params}`,
    {
      method: 'POST',
      json: { origin: { kind: 'test-origin' } },
    }
  )
  expect(response.status).to.equal(204)
}

export async function createLabel(
  projectId,
  userId,
  version,
  comment,
  createdAt
) {
  return await fetchJson(`http://127.0.0.1:3054/project/${projectId}/labels`, {
    method: 'POST',
    json: { comment, version, created_at: createdAt, user_id: userId },
  })
}

export async function getLabels(projectId) {
  return await fetchJson(`http://127.0.0.1:3054/project/${projectId}/labels`)
}

export async function deleteLabelForUser(projectId, userId, labelId) {
  const response = await fetchNothing(
    `http://127.0.0.1:3054/project/${projectId}/user/${userId}/labels/${labelId}`,
    { method: 'DELETE' }
  )
  expect(response.status).to.equal(204)
}

export async function deleteLabel(projectId, labelId) {
  const response = await fetchNothing(
    `http://127.0.0.1:3054/project/${projectId}/labels/${labelId}`,
    { method: 'DELETE' }
  )
  expect(response.status).to.equal(204)
}

export async function setFailures(failureEntries) {
  await db.projectHistoryFailures.deleteMany({})
  return await db.projectHistoryFailures.insertMany(failureEntries)
}

export function getFailure(projectId, callback) {
  db.projectHistoryFailures.findOne({ project_id: projectId }, callback)
}

export async function clearFailure(projectId) {
  await db.projectHistoryFailures.deleteOne({ project_id: projectId })
}

export async function transferLabelOwnership(fromUser, toUser) {
  const response = await fetchNothing(
    `http://127.0.0.1:3054/user/${fromUser}/labels/transfer/${toUser}`,
    { method: 'POST' }
  )
  expect(response.status).to.equal(204)
}

export async function getDump(projectId) {
  return await fetchJson(`http://127.0.0.1:3054/project/${projectId}/dump`)
}

export async function getFailures() {
  const { failures } = await fetchJson('http://127.0.0.1:3054/status/failures')
  return failures
}

export async function getSyncState(projectId) {
  return await db.projectHistorySyncState.findOne({
    project_id: new ObjectId(projectId),
  })
}

export async function getResyncPending(projectId) {
  return await fetchJson(
    `http://127.0.0.1:3054/project/${projectId}/resync-pending`
  )
}

export async function getDebugInfo(projectId) {
  return await fetchJson(
    `http://127.0.0.1:3054/project/${projectId}/debug-info`
  )
}

export async function forceDebugProject(projectId, options = {}) {
  const url = new URL(`http://127.0.0.1:3054/project/${projectId}/force`)
  if (options.clear) {
    url.searchParams.set('clear', 'true')
  }
  return await fetchJson(url.toString(), { method: 'POST' })
}

export async function getRangesSnapshot(projectId, pathname, version) {
  return await fetchJson(
    `http://127.0.0.1:3054/project/${projectId}/ranges/version/${version}/${encodeURIComponent(
      pathname
    )}`
  )
}

export async function getFileMetadataSnapshot(projectId, pathname, version) {
  return await fetchJson(
    `http://127.0.0.1:3054/project/${projectId}/metadata/version/${version}/${encodeURIComponent(
      pathname
    )}`
  )
}

export async function getPathsAtVersion(projectId, version) {
  return await fetchJson(
    `http://127.0.0.1:3054/project/${projectId}/paths/version/${version}`
  )
}

export async function getQueueCounts() {
  return await fetchJson('http://127.0.0.1:3054/status/queue')
}

export async function getFailuresFull() {
  return await fetchJson('http://127.0.0.1:3054/status/failures-full')
}

export async function cloneProject(sourceProjectId, targetProjectId) {
  return await fetchStringWithResponse(
    `http://127.0.0.1:3054/project/${sourceProjectId}/clone`,
    {
      method: 'POST',
      json: { targetProjectId },
    }
  )
}

export async function injectStuckSyncState(projectId, docPaths) {
  await db.projectHistorySyncState.replaceOne(
    { project_id: new ObjectId(projectId) },
    {
      project_id: new ObjectId(projectId),
      resyncProjectStructure: false,
      resyncDocContents: docPaths,
      stuckClearCount: 0,
      history: [],
    },
    { upsert: true }
  )
}

export async function deleteProject(projectId) {
  const response = await fetchNothing(
    `http://127.0.0.1:3054/project/${projectId}`,
    { method: 'DELETE' }
  )
  expect(response.status).to.equal(204)
}
