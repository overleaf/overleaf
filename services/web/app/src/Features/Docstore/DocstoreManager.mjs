// @ts-check
import { callbackify, callbackifyMultiResult } from '@overleaf/promise-utils'
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import Errors from '../Errors/Errors.js'
import {
  fetchJson,
  fetchNothing,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import path from 'node:path'

/**
 * @import { ObjectId } from 'mongodb'
 */

const TIMEOUT = 30 * 1000 // request timeout

/**
 *
 * @param {string | ObjectId} projectId
 * @param {string | ObjectId} docId
 * @param {string} name
 * @param {Date} deletedAt
 * @return {Promise<void>}
 */
async function deleteDoc(projectId, docId, name, deletedAt) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join(
    'project',
    projectId.toString(),
    'doc',
    docId.toString()
  )
  const docMetaData = { deleted: true, deletedAt, name }
  const options = {
    json: docMetaData,
    signal: AbortSignal.timeout(TIMEOUT),
    method: 'PATCH',
  }
  try {
    await fetchNothing(url, options)
  } catch (error) {
    if (error instanceof RequestFailedError) {
      if (error.response.status === 404) {
        // maybe suppress the error when delete doc which is not present?
        throw new Errors.NotFoundError({
          message: 'tried to delete doc not in docstore',
          info: {
            projectId,
            docId,
          },
        })
      }
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        {
          projectId,
          docId,
        }
      )
    }
    throw error
  }
}

/**
 * @param {string} projectId
 */
async function getAllDocs(projectId) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join('project', projectId.toString(), 'doc')
  try {
    return await fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
  } catch (error) {
    if (error instanceof RequestFailedError) {
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        { projectId }
      )
    }
    throw error
  }
}

/**
 *
 * @param {string|ObjectId} projectId
 * @return {Promise<*>}
 */
async function getAllDeletedDocs(projectId) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join('project', projectId.toString(), 'doc-deleted')
  try {
    return await fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
  } catch (error) {
    if (error instanceof RequestFailedError) {
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        { projectId }
      )
    }
    throw OError.tag(error, 'could not get deleted docs from docstore')
  }
}

/**
 * @param {string} projectId
 */
async function getCommentThreadIds(projectId) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/comment-thread-ids`
  return fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
}

/**
 * @param {string} projectId
 */
async function getTrackedChangesUserIds(projectId) {
  const url = `${settings.apis.docstore.url}/project/${projectId}/tracked-changes-user-ids`
  return fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
}

/**
 * @param {string} projectId
 */
async function getAllRanges(projectId) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join('project', projectId, 'ranges')
  try {
    return await fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
  } catch (error) {
    if (error instanceof RequestFailedError) {
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        { projectId }
      )
    }
    throw error
  }
}

/**
 *
 * @param {string | ObjectId} projectId
 * @param {string | ObjectId} docId
 * @param {{ peek?: boolean, include_deleted?: boolean }} options
 * @return {Promise<{lines: *, rev: *, version: *, ranges: *}>}
 */
async function getDoc(projectId, docId, options = {}) {
  const url = new URL(settings.apis.docstore.url)
  if (options.peek) {
    url.pathname = path.posix.join(
      'project',
      projectId.toString(),
      'doc',
      docId.toString(),
      'peek'
    )
  } else {
    url.pathname = path.posix.join(
      'project',
      projectId.toString(),
      'doc',
      docId.toString()
    )
  }
  if (options.include_deleted) {
    url.searchParams.set('include_deleted', 'true')
  }
  try {
    const doc = await fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
    logger.debug(
      { docId, projectId, version: doc.version, rev: doc.rev },
      'got doc from docstore api'
    )
    return {
      lines: doc.lines,
      rev: doc.rev,
      version: doc.version,
      ranges: doc.ranges,
    }
  } catch (error) {
    if (error instanceof RequestFailedError) {
      if (error.response.status === 404) {
        throw new Errors.NotFoundError({
          message: 'doc not found in docstore',
          info: {
            projectId,
            docId,
          },
        })
      }
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        {
          projectId,
          docId,
        }
      )
    }
    throw error
  }
}

/**
 *
 * @param {string} projectId
 * @param {string} docId
 * @return {Promise<boolean>}
 */
async function isDocDeleted(projectId, docId) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join('project', projectId, 'doc', docId, 'deleted')
  try {
    const doc = await fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
    return doc.deleted
  } catch (error) {
    if (error instanceof RequestFailedError) {
      if (error.response.status === 404) {
        throw new Errors.NotFoundError({
          message: 'doc does not exist in project',
          info: { projectId, docId },
        })
      }
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        { projectId, docId }
      )
    }
    throw error
  }
}

/**
 *
 * @param {string} projectId
 * @param {string} docId
 * @param {string[]} lines
 * @param {number} version
 * @param ranges
 * @return {Promise<{modified: *, rev: *}>}
 */
async function updateDoc(projectId, docId, lines, version, ranges) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join('project', projectId, 'doc', docId)
  try {
    const result = await fetchJson(url, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT),
      json: {
        lines,
        version,
        ranges,
      },
    })
    logger.debug({ projectId, docId }, 'update doc in docstore url finished')
    return { modified: result.modified, rev: result.rev }
  } catch (error) {
    if (error instanceof RequestFailedError) {
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        { projectId, docId }
      )
    }
    throw error
  }
}

/**
 * Asks docstore whether any doc in the project has ranges
 *
 * @param {string} projectId
 */
async function projectHasRanges(projectId) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join('project', projectId, 'has-ranges')
  try {
    const body = await fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT) })
    return body.projectHasRanges
  } catch (error) {
    if (error instanceof RequestFailedError) {
      throw new OError(
        `docstore api responded with non-success code: ${error.response.status}`,
        { projectId }
      )
    }
    throw error
  }
}

/**
 *
 * @param {string|ObjectId} projectId
 * @return {Promise<void>}
 */
async function archiveProject(projectId) {
  await _operateOnProject(projectId, 'archive')
}
/**
 *
 * @param {string|ObjectId} projectId
 * @return {Promise<void>}
 */
async function unarchiveProject(projectId) {
  await _operateOnProject(projectId, 'unarchive')
}
/**
 *
 * @param {string|ObjectId} projectId
 * @return {Promise<void>}
 */
async function destroyProject(projectId) {
  await _operateOnProject(projectId, 'destroy')
}

/**
 *
 * @param {string|ObjectId} projectId
 * @param {string} method
 * @return {Promise<void>}
 * @private
 */
async function _operateOnProject(projectId, method) {
  const url = new URL(settings.apis.docstore.url)
  url.pathname = path.posix.join('project', projectId.toString(), method)
  logger.debug({ projectId }, `calling ${method} for project in docstore`)
  try {
    // use default timeout for archiving/unarchiving/destroying
    await fetchNothing(url, {
      method: 'POST',
    })
  } catch (err) {
    if (err instanceof RequestFailedError) {
      const error = new Error(
        `docstore api responded with non-success code: ${err.response.status}`
      )
      logger.warn(
        { err: error, projectId },
        `error calling ${method} project in docstore`
      )
      throw error
    }
    throw OError.tag(err, `error calling ${method} project in docstore`, {
      projectId,
    })
  }
}

export default {
  deleteDoc: callbackify(deleteDoc),
  getAllDocs: callbackify(getAllDocs),
  getAllDeletedDocs: callbackify(getAllDeletedDocs),
  getAllRanges: callbackify(getAllRanges),
  getDoc: callbackifyMultiResult(getDoc, ['lines', 'rev', 'version', 'ranges']),
  getCommentThreadIds: callbackify(getCommentThreadIds),
  getTrackedChangesUserIds: callbackify(getTrackedChangesUserIds),
  isDocDeleted: callbackify(isDocDeleted),
  updateDoc: callbackifyMultiResult(updateDoc, ['modified', 'rev']),
  projectHasRanges: callbackify(projectHasRanges),
  archiveProject: callbackify(archiveProject),
  unarchiveProject: callbackify(unarchiveProject),
  destroyProject: callbackify(destroyProject),
  promises: {
    deleteDoc,
    getAllDocs,
    getAllDeletedDocs,
    getAllRanges,
    getDoc,
    getCommentThreadIds,
    getTrackedChangesUserIds,
    isDocDeleted,
    updateDoc,
    projectHasRanges,
    archiveProject,
    unarchiveProject,
    destroyProject,
  },
}
