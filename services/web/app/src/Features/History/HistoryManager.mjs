import { callbackify } from 'node:util'
import {
  fetchJson,
  fetchNothing,
  fetchStreamWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import fs from 'node:fs'
import settings from '@overleaf/settings'
import OError from '@overleaf/o-error'
import UserGetter from '../User/UserGetter.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import HistoryBackupDeletionHandler from './HistoryBackupDeletionHandler.mjs'
import { db, waitForDb } from '../../infrastructure/mongodb.mjs'
import Metrics from '@overleaf/metrics'
import { NotFoundError } from '../Errors/Errors.js'

const HISTORY_V1_URL = settings.apis.v1_history.url
const HISTORY_V1_BASIC_AUTH = {
  user: settings.apis.v1_history.user,
  password: settings.apis.v1_history.pass,
}

// BEGIN copy from services/history-v1/storage/lib/blob_store/index.js

const GLOBAL_BLOBS = new Set() // CHANGE FROM SOURCE: only store hashes.

async function loadGlobalBlobs() {
  await waitForDb() // CHANGE FROM SOURCE: wait for db before running query.
  const blobs = db.projectHistoryGlobalBlobs.find()
  for await (const blob of blobs) {
    GLOBAL_BLOBS.add(blob._id) // CHANGE FROM SOURCE: only store hashes.
  }
}

// END copy from services/history-v1/storage/lib/blob_store/index.js

function getFilestoreBlobURL(historyId, hash) {
  if (GLOBAL_BLOBS.has(hash)) {
    return `${settings.apis.filestore.url}/history/global/hash/${hash}`
  } else {
    return `${settings.apis.filestore.url}/history/project/${historyId}/hash/${hash}`
  }
}

async function initializeProject(projectId) {
  const body = await fetchJson(`${settings.apis.project_history.url}/project`, {
    method: 'POST',
    json: { historyId: projectId.toString() },
  })
  const historyId = body && body.project && body.project.id
  if (!historyId) {
    throw new OError('project-history did not provide an id', { body })
  }
  return historyId
}

async function flushProject(projectId) {
  try {
    await fetchNothing(
      `${settings.apis.project_history.url}/project/${projectId}/flush`,
      { method: 'POST' }
    )
  } catch (err) {
    throw OError.tag(err, 'failed to flush project to project history', {
      projectId,
    })
  }
}

async function deleteProjectHistory(projectId) {
  try {
    await fetchNothing(
      `${settings.apis.project_history.url}/project/${projectId}`,
      { method: 'DELETE' }
    )
  } catch (err) {
    throw OError.tag(err, 'failed to delete project history', {
      projectId,
    })
  }
}

async function resyncProject(projectId, options = {}) {
  const body = {}
  if (options.force) {
    body.force = options.force
  }
  if (options.origin) {
    body.origin = options.origin
  }
  if (options.historyRangesMigration) {
    body.historyRangesMigration = options.historyRangesMigration
  }
  try {
    await fetchNothing(
      `${settings.apis.project_history.url}/project/${projectId}/resync`,
      {
        method: 'POST',
        json: body,
        signal: AbortSignal.timeout(6 * 60 * 1000),
      }
    )
  } catch (err) {
    throw OError.tag(err, 'failed to resync project history', {
      projectId,
    })
  }
}

async function deleteProject(projectId, historyId) {
  const tasks = []
  tasks.push(_deleteProjectInProjectHistory(projectId))
  if (historyId != null) {
    tasks.push(_deleteProjectInFullProjectHistory(historyId))
  }
  await Promise.all(tasks)
  await HistoryBackupDeletionHandler.deleteProject(projectId)
}

async function _deleteProjectInProjectHistory(projectId) {
  try {
    await fetchNothing(
      `${settings.apis.project_history.url}/project/${projectId}`,
      { method: 'DELETE' }
    )
  } catch (err) {
    throw OError.tag(
      err,
      'failed to clear project history in project-history',
      { projectId }
    )
  }
}

async function _deleteProjectInFullProjectHistory(historyId) {
  try {
    await fetchNothing(`${HISTORY_V1_URL}/projects/${historyId}`, {
      method: 'DELETE',
      basicAuth: HISTORY_V1_BASIC_AUTH,
    })
  } catch (err) {
    throw OError.tag(err, 'failed to clear project history', { historyId })
  }
}

async function uploadBlobFromDisk(historyId, hash, byteLength, fsPath) {
  const outStream = fs.createReadStream(fsPath)

  const url = `${HISTORY_V1_URL}/projects/${historyId}/blobs/${hash}`
  await fetchNothing(url, {
    method: 'PUT',
    body: outStream,
    headers: { 'Content-Length': byteLength }, // add the content length to work around problems with chunked encoding in node 18
    signal: AbortSignal.timeout(60 * 1000),
    basicAuth: HISTORY_V1_BASIC_AUTH,
  })
}

async function copyBlob(sourceHistoryId, targetHistoryId, hash) {
  const url = `${HISTORY_V1_URL}/projects/${targetHistoryId}/blobs/${hash}`
  await fetchNothing(
    `${url}?${new URLSearchParams({ copyFrom: sourceHistoryId })}`,
    {
      method: 'POST',
      basicAuth: HISTORY_V1_BASIC_AUTH,
    }
  )
}

async function requestBlobWithProjectId(
  projectId,
  hash,
  method = 'GET',
  range = ''
) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    'overleaf.history.id': true,
  })
  return requestBlob(project.overleaf.history.id, hash, method, range)
}

async function requestBlob(historyId, hash, method = 'GET', range = '') {
  // Talk to history-v1 directly to avoid streaming via project-history.
  const url = new URL(HISTORY_V1_URL)
  url.pathname += `/projects/${historyId}/blobs/${hash}`

  const opts = { method, headers: { Range: range } }
  let stream, response
  try {
    ;({ stream, response } = await fetchStreamWithResponse(url, {
      ...opts,
      basicAuth: {
        user: settings.apis.v1_history.user,
        password: settings.apis.v1_history.pass,
      },
    }))
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      throw new NotFoundError()
    } else {
      throw err
    }
  }
  Metrics.inc('request_blob', 1, { path: 'history-v1' })
  return {
    url,
    stream,
    contentLength: parseInt(response.headers.get('Content-Length'), 10),
    contentRange: response.headers.get('Content-Range'),
  }
}

/**
 * Warning: Don't use this method for large projects. It will eagerly load all
 * the history data and apply all operations.
 * @param {string} projectId
 * @returns Promise<object>
 */
async function getCurrentContent(projectId) {
  const historyId = await getHistoryId(projectId)

  try {
    return await fetchJson(
      `${HISTORY_V1_URL}/projects/${historyId}/latest/content`,
      {
        method: 'GET',
        basicAuth: HISTORY_V1_BASIC_AUTH,
      }
    )
  } catch (err) {
    throw OError.tag(err, 'failed to load project history', { historyId })
  }
}

/**
 * Warning: Don't use this method for large projects. It will eagerly load all
 * the history data and apply all operations.
 * @param {string} projectId
 * @param {number} version
 *
 * @returns Promise<object>
 */
async function getContentAtVersion(projectId, version) {
  const historyId = await getHistoryId(projectId)

  try {
    return await fetchJson(
      `${HISTORY_V1_URL}/projects/${historyId}/versions/${version}/content`,
      {
        method: 'GET',
        basicAuth: HISTORY_V1_BASIC_AUTH,
      }
    )
  } catch (err) {
    throw OError.tag(
      err,
      'failed to load project history snapshot at version',
      { historyId, version }
    )
  }
}

/**
 * Get the latest chunk from history
 *
 * @param {string} projectId
 */
async function getLatestHistory(projectId) {
  const historyId = await getHistoryId(projectId)

  return await fetchJson(
    `${HISTORY_V1_URL}/projects/${historyId}/latest/history`,
    {
      basicAuth: HISTORY_V1_BASIC_AUTH,
    }
  )
}

/**
 * Get history changes since a given version
 *
 * @param {string} projectId
 * @param {object} [opts]
 * @param {number} [opts.since] - The start version of changes to get
 */
async function getChanges(projectId, opts = {}) {
  const historyId = await getHistoryId(projectId)

  const url = new URL(`${HISTORY_V1_URL}/projects/${historyId}/changes`)
  if (opts.since) {
    url.searchParams.set('since', opts.since)
  }

  return await fetchJson(url, {
    basicAuth: HISTORY_V1_BASIC_AUTH,
  })
}

async function getHistoryId(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    overleaf: true,
  })
  const historyId = project?.overleaf?.history?.id
  if (!historyId) {
    throw new OError('project does not have a history id', { projectId })
  }
  return historyId
}

async function getBlobStats(historyId, blobHashes) {
  return await fetchJson(`${HISTORY_V1_URL}/projects/${historyId}/blob-stats`, {
    method: 'POST',
    basicAuth: HISTORY_V1_BASIC_AUTH,
    json: { blobHashes: blobHashes.map(id => id.toString()) },
  })
}

async function getProjectBlobStats(historyIds) {
  return await fetchJson(`${HISTORY_V1_URL}/projects/blob-stats`, {
    method: 'POST',
    basicAuth: HISTORY_V1_BASIC_AUTH,
    json: { projectIds: historyIds.map(id => id.toString()) },
  })
}

async function injectUserDetails(data) {
  // data can be either:
  // {
  // 	diff: [{
  // 		i: "foo",
  // 		meta: {
  // 			users: ["user_id", v1_user_id, ...]
  // 			...
  // 		}
  // 	}, ...]
  // }
  // or
  // {
  // 	updates: [{
  // 		pathnames: ["main.tex"]
  // 		meta: {
  // 			users: ["user_id", v1_user_id, ...]
  // 			...
  // 		},
  // 		...
  // 	}, ...]
  // }
  // Either way, the top level key points to an array of objects with a meta.users property
  // that we need to replace user_ids with populated user objects.
  // Note that some entries in the users arrays may be v1 ids returned by the v1 history
  // service. v1 ids will be `numbers`
  let userIds = new Set()
  let v1UserIds = new Set()
  const entries = Array.isArray(data.diff)
    ? data.diff
    : Array.isArray(data.updates)
      ? data.updates
      : []
  for (const entry of entries) {
    for (const user of (entry.meta && entry.meta.users) || []) {
      if (typeof user === 'string') {
        userIds.add(user)
      } else if (typeof user === 'number') {
        v1UserIds.add(user)
      }
    }
  }

  userIds = Array.from(userIds)
  v1UserIds = Array.from(v1UserIds)
  const projection = { first_name: 1, last_name: 1, email: 1 }
  const usersArray = await UserGetter.promises.getUsers(userIds, projection)
  const users = {}
  for (const user of usersArray) {
    users[user._id.toString()] = _userView(user)
  }
  projection.overleaf = 1
  const v1IdentifiedUsersArray = await UserGetter.promises.getUsersByV1Ids(
    v1UserIds,
    projection
  )
  for (const user of v1IdentifiedUsersArray) {
    users[user.overleaf.id] = _userView(user)
  }
  for (const entry of entries) {
    if (entry.meta != null) {
      entry.meta.users = ((entry.meta && entry.meta.users) || []).map(user => {
        if (typeof user === 'string' || typeof user === 'number') {
          return users[user]
        } else {
          return user
        }
      })
    }
  }
  return data
}

function _userView(user) {
  const { _id, first_name: firstName, last_name: lastName, email } = user
  return { first_name: firstName, last_name: lastName, email, id: _id }
}

const loadGlobalBlobsPromise = loadGlobalBlobs()

export default {
  getFilestoreBlobURL,
  loadGlobalBlobsPromise,
  initializeProject: callbackify(initializeProject),
  flushProject: callbackify(flushProject),
  resyncProject: callbackify(resyncProject),
  deleteProject: callbackify(deleteProject),
  deleteProjectHistory: callbackify(deleteProjectHistory),
  injectUserDetails: callbackify(injectUserDetails),
  getCurrentContent: callbackify(getCurrentContent),
  uploadBlobFromDisk: callbackify(uploadBlobFromDisk),
  copyBlob: callbackify(copyBlob),
  requestBlob: callbackify(requestBlob),
  requestBlobWithProjectId: callbackify(requestBlobWithProjectId),
  getLatestHistory: callbackify(getLatestHistory),
  getChanges: callbackify(getChanges),
  promises: {
    initializeProject,
    flushProject,
    resyncProject,
    deleteProject,
    injectUserDetails,
    deleteProjectHistory,
    getCurrentContent,
    getContentAtVersion,
    uploadBlobFromDisk,
    copyBlob,
    requestBlob,
    requestBlobWithProjectId,
    getLatestHistory,
    getChanges,
    getProjectBlobStats,
    getBlobStats,
  },
}
