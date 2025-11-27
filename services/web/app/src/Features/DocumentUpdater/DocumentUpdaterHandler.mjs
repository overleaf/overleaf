import OError from '@overleaf/o-error'
import settings from '@overleaf/settings'
import {
  fetchJson,
  fetchNothing,
  fetchString,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import _ from 'lodash'
import logger from '@overleaf/logger'
import { callbackifyAll } from '@overleaf/promise-utils'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import Modules from '../../infrastructure/Modules.mjs'

const REQUEST_TIMEOUT_MS = 30 * 1000
const RESYNC_TIMEOUT_MS = 6 * 60 * 1000
const BASE_URL = settings.apis.documentupdater.url

async function getProjectLastUpdatedAt(projectId) {
  const body = await fetchJson(
    `${BASE_URL}/project/${projectId}/last_updated_at`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  )
  return body.lastUpdatedAt != null ? new Date(body.lastUpdatedAt) : null
}

async function getProjectRanges(projectId) {
  const { docs } = await fetchJson(`${BASE_URL}/project/${projectId}/ranges`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return docs
}

/**
 * @param {string} projectId
 */
async function flushProjectToMongo(projectId) {
  await fetchNothing(`${BASE_URL}/project/${projectId}/flush`, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

async function flushMultipleProjectsToMongo(projectIds) {
  for (const projectId of projectIds) {
    await flushProjectToMongo(projectId)
  }
}

/**
 * @param {string} projectId
 */
async function flushProjectToMongoAndDelete(projectId) {
  await fetchNothing(`${BASE_URL}/project/${projectId}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

/**
 * @param {string} projectId
 * @param {string} docId
 */
async function flushDocToMongo(projectId, docId) {
  await fetchNothing(`${BASE_URL}/project/${projectId}/doc/${docId}/flush`, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

async function deleteDoc(projectId, docId, ignoreFlushErrors = false) {
  const url = new URL(`${BASE_URL}/project/${projectId}/doc/${docId}`)
  if (ignoreFlushErrors) {
    url.searchParams.set('ignore_flush_errors', 'true')
  }
  await fetchNothing(url, {
    method: 'DELETE',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

async function getComment(projectId, docId, commentId) {
  const comment = await fetchJson(
    `${BASE_URL}/project/${projectId}/doc/${docId}/comment/${commentId}`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  )
  return comment
}

async function getDocument(projectId, docId, fromVersion) {
  const url = new URL(`${BASE_URL}/project/${projectId}/doc/${docId}`)
  url.searchParams.set('fromVersion', fromVersion)
  const doc = await fetchJson(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return {
    lines: doc.lines,
    version: doc.version,
    ranges: doc.ranges,
    ops: doc.ops,
  }
}

/**
 * Get a document with its history ranges
 * @param {string} projectId
 * @param {string} docId
 */
async function getDocumentWithHistoryRanges(projectId, docId) {
  const doc = await fetchJson(
    `${BASE_URL}/project/${projectId}/doc/${docId}?historyRanges=true`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  )
  return doc
}

async function setDocument(projectId, docId, userId, docLines, source) {
  const maybeJson = await fetchString(
    `${BASE_URL}/project/${projectId}/doc/${docId}`,
    {
      method: 'POST',
      json: {
        lines: docLines,
        source,
        user_id: userId,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )

  // The set document endpoint sometimes returns json and sometimes just an
  // empty response
  try {
    const { rev, modified } = JSON.parse(maybeJson)
    return { rev, modified }
  } catch (err) {
    return undefined
  }
}

async function appendToDocument(projectId, docId, userId, lines, source) {
  const maybeJson = await fetchString(
    `${BASE_URL}/project/${projectId}/doc/${docId}/append`,
    {
      method: 'POST',
      json: {
        lines,
        source,
        user_id: userId,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )

  // The append to document endpoint sometimes returns json and sometimes just an
  // empty response
  try {
    const { rev, modified } = JSON.parse(maybeJson)
    return { rev, modified }
  } catch (err) {
    return undefined
  }
}

async function getProjectDocsIfMatch(projectId, projectStateHash) {
  // If the project state hasn't changed, we can get all the latest
  // docs from redis via the docupdater. Otherwise we will need to
  // fall back to getting them from mongo.
  const url = new URL(`${BASE_URL}/project/${projectId}/get_and_flush_if_old`)
  url.searchParams.set('state', projectStateHash)

  let docs
  try {
    docs = await fetchJson(url, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 409) {
      // HTTP response code "409 Conflict"
      // Docupdater has checked the projectStateHash and found that
      // it has changed. This means that the docs currently in redis
      // aren't the only change to the project and the full set of
      // docs/files should be retreived from docstore/filestore
      // instead.
      return undefined
    } else {
      throw err
    }
  }
  return docs
}

async function clearProjectState(projectId) {
  await fetchNothing(`${BASE_URL}/project/${projectId}/clearState`, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

/**
 * @param {string} projectId
 * @param {string} docId
 * @param {string[]} changeIds
 */
async function acceptChanges(projectId, docId, changeIds, userId) {
  await fetchNothing(
    `${BASE_URL}/project/${projectId}/doc/${docId}/change/accept`,
    {
      method: 'POST',
      json: { change_ids: changeIds },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )

  await Modules.promises.hooks.fire('changesAccepted', projectId, docId, userId)
}

/**
 * @param {string} projectId
 * @param {string} docId
 * @param {string[]} changeIds
 */
async function rejectChanges(projectId, docId, changeIds, userId) {
  const { rejectedChangeIds } = await fetchJson(
    `${BASE_URL}/project/${projectId}/doc/${docId}/change/reject`,
    {
      method: 'POST',
      json: { change_ids: changeIds, user_id: userId },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )
  return { rejectedChangeIds }
}

/**
 * @param {string} projectId
 * @param {string} docId
 * @param {string} threadId
 * @param {string} userId
 */
async function resolveThread(projectId, docId, threadId, userId) {
  await fetchNothing(
    `${BASE_URL}/project/${projectId}/doc/${docId}/comment/${threadId}/resolve`,
    {
      method: 'POST',
      json: { user_id: userId },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )
}

/**
 * @param {string} projectId
 * @param {string} docId
 * @param {string} threadId
 * @param {string} userId
 */
async function reopenThread(projectId, docId, threadId, userId) {
  await fetchNothing(
    `${BASE_URL}/project/${projectId}/doc/${docId}/comment/${threadId}/reopen`,
    {
      method: 'POST',
      json: { user_id: userId },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )
}

async function deleteThread(projectId, docId, threadId, userId) {
  await fetchNothing(
    `${BASE_URL}/project/${projectId}/doc/${docId}/comment/${threadId}`,
    {
      method: 'DELETE',
      json: { user_id: userId },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )
}

async function resyncProjectHistory(
  projectId,
  projectHistoryId,
  docs,
  files,
  opts
) {
  docs = docs.map(doc => ({
    doc: doc.doc._id,
    path: doc.path,
  }))
  // Files without a hash likely do not have a blob. Abort.
  for (const { file } of files) {
    if (!file.hash) {
      throw new OError('found file with missing hash', { projectId, file })
    }
  }
  files = files.map(file => ({
    file: file.file._id,
    path: file.path,
    _hash: file.file.hash,
    createdBlob: true,
    metadata: buildFileMetadataForHistory(file.file),
  }))

  const body = { docs, files, projectHistoryId }
  if (opts.historyRangesMigration) {
    body.historyRangesMigration = opts.historyRangesMigration
  }
  if (opts.resyncProjectStructureOnly) {
    body.resyncProjectStructureOnly = opts.resyncProjectStructureOnly
  }
  await fetchNothing(`${BASE_URL}/project/${projectId}/history/resync`, {
    json: body,
    method: 'POST',
    signal: AbortSignal.timeout(RESYNC_TIMEOUT_MS), // allow 6 minutes for resync
  })
}

/**
 * Block a project from being loaded in docupdater
 *
 * @param {string} projectId
 */
async function blockProject(projectId) {
  const body = await fetchJson(`${BASE_URL}/project/${projectId}/block`, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return body.blocked
}

/**
 * Unblock a previously blocked project
 *
 * @param {string} projectId
 */
async function unblockProject(projectId) {
  const body = await fetchJson(`${BASE_URL}/project/${projectId}/unblock`, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return body.wasBlocked
}

async function updateProjectStructure(
  projectId,
  projectHistoryId,
  userId,
  changes,
  source
) {
  if (
    settings.apis.project_history == null ||
    !settings.apis.project_history.sendProjectStructureOps
  ) {
    return
  }

  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { overleaf: true }
  )
  const historyRangesSupport = _.get(
    project,
    'overleaf.history.rangesSupportEnabled',
    false
  )
  const {
    deletes: docDeletes,
    adds: docAdds,
    renames: docRenames,
  } = _getUpdates('doc', changes.oldDocs, changes.newDocs, historyRangesSupport)
  for (const newEntity of changes.newFiles || []) {
    if (!newEntity.file.hash) {
      // Files without a hash likely do not have a blob. Abort.
      throw new OError('found file with missing hash', { newEntity })
    }
  }
  const {
    deletes: fileDeletes,
    adds: fileAdds,
    renames: fileRenames,
  } = _getUpdates(
    'file',
    changes.oldFiles,
    changes.newFiles,
    historyRangesSupport
  )
  const updates = [].concat(
    docDeletes,
    fileDeletes,
    docAdds,
    fileAdds,
    docRenames,
    fileRenames
  )
  const projectVersion =
    changes && changes.newProject && changes.newProject.version

  if (updates.length < 1) {
    return
  }

  if (projectVersion == null) {
    logger.warn(
      { projectId, changes, projectVersion },
      'did not receive project version in changes'
    )
    throw new Error('did not receive project version in changes')
  }

  await fetchNothing(`${BASE_URL}/project/${projectId}`, {
    method: 'POST',
    json: {
      updates,
      userId,
      version: projectVersion,
      projectHistoryId,
      source,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

function _getUpdates(
  entityType,
  oldEntities,
  newEntities,
  historyRangesSupport
) {
  if (!oldEntities) {
    oldEntities = []
  }
  if (!newEntities) {
    newEntities = []
  }
  const deletes = []
  const adds = []
  const renames = []

  const oldEntitiesHash = _.keyBy(oldEntities, entity =>
    entity[entityType]._id.toString()
  )
  const newEntitiesHash = _.keyBy(newEntities, entity =>
    entity[entityType]._id.toString()
  )

  // Send deletes before adds (and renames) to keep a 1:1 mapping between
  // paths and ids
  //
  // When a file is replaced, we first delete the old file and then add the
  // new file. If the 'add' operation is sent to project history before the
  // 'delete' then we would have two files with the same path at that point
  // in time.
  for (const id in oldEntitiesHash) {
    const oldEntity = oldEntitiesHash[id]
    const newEntity = newEntitiesHash[id]

    if (newEntity == null) {
      // entity deleted
      deletes.push({
        type: `rename-${entityType}`,
        id,
        pathname: oldEntity.path,
        newPathname: '',
      })
    }
  }
  for (const id in newEntitiesHash) {
    const newEntity = newEntitiesHash[id]
    const oldEntity = oldEntitiesHash[id]

    if (oldEntity == null) {
      // entity added
      adds.push({
        type: `add-${entityType}`,
        id,
        pathname: newEntity.path,
        docLines: newEntity.docLines,
        ranges: newEntity.ranges,
        historyRangesSupport,
        hash: newEntity.file?.hash,
        metadata: buildFileMetadataForHistory(newEntity.file),
        createdBlob: true,
      })
    } else if (newEntity.path !== oldEntity.path) {
      // entity renamed
      renames.push({
        type: `rename-${entityType}`,
        id,
        pathname: oldEntity.path,
        newPathname: newEntity.path,
      })
    }
  }

  return { deletes, adds, renames }
}

function buildFileMetadataForHistory(file) {
  if (!file?.linkedFileData) return undefined

  const metadata = {
    // Files do not have a created at timestamp in the history.
    // For cloned projects, the importedAt timestamp needs to remain untouched.
    // Record the timestamp in the metadata blob to keep everything self-contained.
    importedAt: file.created,
    ...file.linkedFileData,
  }
  if (metadata.provider === 'project_output_file') {
    // The build-id and clsi-server-id are only used for downloading file.
    // Omit them from history as they are not useful in the future.
    delete metadata.build_id
    delete metadata.clsiServerId
  }
  return metadata
}

const DocumentUpdaterHandler = {
  flushProjectToMongo,
  flushMultipleProjectsToMongo,
  flushProjectToMongoAndDelete,
  flushDocToMongo,
  deleteDoc,
  getComment,
  getDocument,
  getProjectLastUpdatedAt,
  getProjectRanges,
  setDocument,
  appendToDocument,
  getProjectDocsIfMatch,
  clearProjectState,
  acceptChanges,
  rejectChanges,
  resolveThread,
  reopenThread,
  deleteThread,
  resyncProjectHistory,
  blockProject,
  unblockProject,
  updateProjectStructure,
  getDocumentWithHistoryRanges,
}

export default {
  ...callbackifyAll(DocumentUpdaterHandler, {
    multiResult: {
      getDocument: ['lines', 'version', 'ranges', 'ops'],
    },
  }),
  promises: DocumentUpdaterHandler,
}
