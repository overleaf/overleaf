import { expect } from 'chai'
import request from 'request'
import Settings from '@overleaf/settings'
import RedisWrapper from '@overleaf/redis-wrapper'
import { db } from '../../../../app/js/mongodb.js'
import { promisify } from '@overleaf/promise-utils'
import {
  fetchJsonWithResponse,
  fetchNothing,
  RequestFailedError,
} from '@overleaf/fetch-utils'

const rclient = RedisWrapper.createClient(Settings.redis.project_history)
const Keys = Settings.redis.project_history.key_schema

export function resetDatabase(callback) {
  rclient.flushdb(callback)
}

export function initializeProject(historyId, callback) {
  request.post(
    {
      url: 'http://127.0.0.1:3054/project',
      json: { historyId },
    },
    (error, res, body) => {
      if (error) {
        return callback(error)
      }
      expect(res.statusCode).to.equal(200)
      callback(null, body.project)
    }
  )
}

export function flushProject(projectId, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = null
  }
  if (!options) {
    options = { allowErrors: false }
  }
  request.post(
    {
      url: `http://127.0.0.1:3054/project/${projectId}/flush`,
    },
    (error, res, body) => {
      if (error) {
        return callback(error)
      }
      if (!options.allowErrors) {
        expect(res.statusCode).to.equal(204)
      }
      callback(error, res)
    }
  )
}

export async function getSummarizedUpdates(projectId, query) {
  const url = new URL(`http://127.0.0.1:3054/project/${projectId}/updates`)
  Object.keys(query).forEach(key => {
    url.searchParams.set(key, query[key])
  })

  const { response, json } = await fetchJsonWithResponse(url.toString())
  expect(response.status).to.equal(200)
  return json
}

export async function getDiff(projectId, pathname, from, to) {
  const url = new URL(`http://127.0.0.1:3054/project/${projectId}/diff`)
  url.searchParams.set('pathname', pathname)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)

  const { response, json } = await fetchJsonWithResponse(url.toString())
  expect(response.status).to.equal(200)
  return json
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

export function getLatestSnapshot(projectId, callback) {
  request.get(
    {
      url: `http://127.0.0.1:3054/project/${projectId}/snapshot`,
      json: true,
    },
    (error, res, body) => {
      if (error) {
        return callback(error)
      }
      expect(res.statusCode).to.equal(200)
      callback(null, body)
    }
  )
}

export function getSnapshot(projectId, pathname, version, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = null
  }
  if (!options) {
    options = { allowErrors: false }
  }
  request.get(
    {
      url: `http://127.0.0.1:3054/project/${projectId}/version/${version}/${encodeURIComponent(
        pathname
      )}`,
    },
    (error, res, body) => {
      if (error) {
        return callback(error)
      }
      if (!options.allowErrors) {
        expect(res.statusCode).to.equal(200)
      }
      callback(error, body, res.statusCode)
    }
  )
}

export function pushRawUpdate(projectId, update, callback) {
  rclient.rpush(
    Keys.projectHistoryOps({ project_id: projectId }),
    JSON.stringify(update),
    callback
  )
}

export function setFirstOpTimestamp(projectId, timestamp, callback) {
  rclient.set(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId }),
    timestamp,
    callback
  )
}

export function getFirstOpTimestamp(projectId, callback) {
  rclient.get(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId }),
    callback
  )
}

export function clearFirstOpTimestamp(projectId, callback) {
  rclient.del(
    Keys.projectHistoryFirstOpTimestamp({ project_id: projectId }),
    callback
  )
}

export function getQueueLength(projectId, callback) {
  rclient.llen(Keys.projectHistoryOps({ project_id: projectId }), callback)
}

export function getQueueCounts(callback) {
  return request.get(
    {
      url: 'http://127.0.0.1:3054/status/queue',
      json: true,
    },
    callback
  )
}

export function resyncHistory(projectId, callback) {
  request.post(
    {
      url: `http://127.0.0.1:3054/project/${projectId}/resync`,
      json: true,
      body: { origin: { kind: 'test-origin' } },
    },
    (error, res, body) => {
      if (error) {
        return callback(error)
      }
      expect(res.statusCode).to.equal(204)
      callback(error)
    }
  )
}

export async function createLabel(
  projectId,
  userId,
  version,
  comment,
  createdAt
) {
  const { response, json } = await fetchJsonWithResponse(
    `http://127.0.0.1:3054/project/${projectId}/labels`,
    {
      method: 'POST',
      json: { comment, version, created_at: createdAt, user_id: userId },
    }
  )
  expect(response.status).to.equal(200)
  return json
}

export async function getLabels(projectId) {
  const { response, json } = await fetchJsonWithResponse(
    `http://127.0.0.1:3054/project/${projectId}/labels`
  )
  expect(response.status).to.equal(200)
  return json
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

export async function setFailure(failureEntry) {
  await db.projectHistoryFailures.deleteOne({ project_id: { $exists: true } })
  return await db.projectHistoryFailures.insertOne(failureEntry)
}

export function getFailure(projectId, callback) {
  db.projectHistoryFailures.findOne({ project_id: projectId }, callback)
}

export async function transferLabelOwnership(fromUser, toUser) {
  const response = await fetchNothing(
    `http://127.0.0.1:3054/user/${fromUser}/labels/transfer/${toUser}`,
    { method: 'POST' }
  )
  expect(response.status).to.equal(204)
}

export async function getDump(projectId) {
  const { response, json } = await fetchJsonWithResponse(
    `http://127.0.0.1:3054/project/${projectId}/dump`
  )
  expect(response.status).to.equal(200)
  return json
}

export async function deleteProject(projectId) {
  const response = await fetchNothing(
    `http://127.0.0.1:3054/project/${projectId}`,
    { method: 'DELETE' }
  )
  expect(response.status).to.equal(204)
}

export const promises = {
  initializeProject: promisify(initializeProject),
  pushRawUpdate: promisify(pushRawUpdate),
  setFirstOpTimestamp: promisify(setFirstOpTimestamp),
  getFirstOpTimestamp: promisify(getFirstOpTimestamp),
  flushProject: promisify(flushProject),
}
