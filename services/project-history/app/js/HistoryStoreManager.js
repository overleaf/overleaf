import { promisify } from 'node:util'
import fs from 'node:fs'
import request from 'request'
import stream from 'node:stream'
import logger from '@overleaf/logger'
import _ from 'lodash'
import { URL } from 'node:url'
import OError from '@overleaf/o-error'
import Settings from '@overleaf/settings'
import {
  fetchStream,
  fetchNothing,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import * as Versions from './Versions.js'
import * as Errors from './Errors.js'
import * as LocalFileWriter from './LocalFileWriter.js'
import * as HashManager from './HashManager.js'
import * as HistoryBlobTranslator from './HistoryBlobTranslator.js'
import { promisifyMultiResult } from '@overleaf/promise-utils'

const HTTP_REQUEST_TIMEOUT = Settings.overleaf.history.requestTimeout

/**
 * Container for functions that need to be mocked in tests
 *
 * TODO: Rewrite tests in terms of exported functions only
 */
export const _mocks = {}

class StringStream extends stream.Readable {
  _read() {}
}

_mocks.getMostRecentChunk = (projectId, historyId, callback) => {
  const path = `projects/${historyId}/latest/history`
  logger.debug({ projectId, historyId }, 'getting chunk from history service')
  _requestChunk({ path, json: true }, (err, chunk) => {
    if (err) return callback(OError.tag(err))
    callback(null, chunk)
  })
}

/**
 * @param {Callback} callback
 */
export function getMostRecentChunk(projectId, historyId, callback) {
  _mocks.getMostRecentChunk(projectId, historyId, callback)
}

/**
 * @param {Callback} callback
 */
export function getChunkAtVersion(projectId, historyId, version, callback) {
  const path = `projects/${historyId}/versions/${version}/history`
  logger.debug(
    { projectId, historyId, version },
    'getting chunk from history service for version'
  )
  _requestChunk({ path, json: true }, (err, chunk) => {
    if (err) return callback(OError.tag(err))
    callback(null, chunk)
  })
}

export function getMostRecentVersion(projectId, historyId, callback) {
  getMostRecentChunk(projectId, historyId, (error, chunk) => {
    if (error) {
      return callback(OError.tag(error))
    }
    const mostRecentVersion =
      chunk.chunk.startVersion + (chunk.chunk.history.changes || []).length
    const lastChange = _.last(
      _.sortBy(chunk.chunk.history.changes || [], x => x.timestamp)
    )
    // find the latest project and doc versions in the chunk
    _getLatestProjectVersion(projectId, chunk, (err1, projectVersion) => {
      if (err1) err1 = OError.tag(err1)
      _getLatestV2DocVersions(projectId, chunk, (err2, v2DocVersions) => {
        if (err2) err2 = OError.tag(err2)
        // return the project and doc versions
        const projectStructureAndDocVersions = {
          project: projectVersion,
          docs: v2DocVersions,
        }
        callback(
          err1 || err2,
          mostRecentVersion,
          projectStructureAndDocVersions,
          lastChange,
          chunk
        )
      })
    })
  })
}

/**
 * @param {string} projectId
 * @param {string} historyId
 * @param {Object} opts
 * @param {boolean} [opts.readOnly]
 * @param {(error: Error, rawChunk?: { startVersion: number, endVersion: number, endTimestamp: Date}) => void} callback
 */
export function getMostRecentVersionRaw(projectId, historyId, opts, callback) {
  const path = `projects/${historyId}/latest/history/raw`
  logger.debug(
    { projectId, historyId },
    'getting raw chunk from history service'
  )
  const qs = opts.readOnly ? { readOnly: true } : {}
  _requestHistoryService({ path, json: true, qs }, (err, body) => {
    if (err) return callback(OError.tag(err))
    const { startVersion, endVersion, endTimestamp } = body
    callback(null, {
      startVersion,
      endVersion,
      endTimestamp: new Date(endTimestamp),
    })
  })
}

function _requestChunk(options, callback) {
  _requestHistoryService(options, (err, chunk) => {
    if (err) {
      return callback(OError.tag(err))
    }
    if (
      chunk == null ||
      chunk.chunk == null ||
      chunk.chunk.startVersion == null
    ) {
      const { path } = options
      return callback(new OError('unexpected response', { path }))
    }
    callback(null, chunk)
  })
}

function _getLatestProjectVersion(projectId, chunk, callback) {
  // find the initial project version
  const projectVersionInSnapshot = chunk.chunk.history.snapshot?.projectVersion
  let projectVersion = projectVersionInSnapshot
  const chunkStartVersion = chunk.chunk.startVersion
  // keep track of any first error
  let error = null
  // iterate over the changes in chunk to find the most recent project version
  for (const [changeIdx, change] of (
    chunk.chunk.history.changes || []
  ).entries()) {
    const projectVersionInChange = change.projectVersion
    if (projectVersionInChange != null) {
      if (
        projectVersion != null &&
        Versions.lt(projectVersionInChange, projectVersion)
      ) {
        if (!error) {
          error = new Errors.OpsOutOfOrderError(
            'project structure version out of order',
            {
              projectId,
              chunkStartVersion,
              projectVersionInSnapshot,
              changeIdx,
              projectVersion,
              projectVersionInChange,
            }
          )
        }
      } else {
        projectVersion = projectVersionInChange
      }
    }
  }
  callback(error, projectVersion)
}

function _getLatestV2DocVersions(projectId, chunk, callback) {
  // find the initial doc versions (indexed by docId as this is immutable)
  const v2DocVersions =
    (chunk.chunk.history.snapshot &&
      chunk.chunk.history.snapshot.v2DocVersions) ||
    {}
  // keep track of any errors
  let error = null
  // iterate over the changes in the chunk to find the most recent doc versions
  for (const change of chunk.chunk.history.changes || []) {
    if (change.v2DocVersions != null) {
      for (const docId in change.v2DocVersions) {
        const docInfo = change.v2DocVersions[docId]
        const { v } = docInfo
        if (
          v2DocVersions[docId] &&
          v2DocVersions[docId].v != null &&
          Versions.lt(v, v2DocVersions[docId].v)
        ) {
          if (!error) {
            logger.warn(
              {
                projectId,
                docId,
                changeVersion: docInfo,
                previousVersion: v2DocVersions[docId],
              },
              'doc version out of order in chunk'
            )
            error = new Errors.OpsOutOfOrderError('doc version out of order')
          }
        } else {
          v2DocVersions[docId] = docInfo
        }
      }
    }
  }
  callback(error, v2DocVersions)
}

export function getProjectBlob(historyId, blobHash, callback) {
  logger.debug({ historyId, blobHash }, 'getting blob from history service')
  _requestHistoryService(
    { path: `projects/${historyId}/blobs/${blobHash}` },
    (err, blob) => {
      if (err) return callback(OError.tag(err))
      callback(null, blob)
    }
  )
}

/**
 * @param {Callback} callback
 */
export function getProjectBlobStream(historyId, blobHash, callback) {
  const url = `${Settings.overleaf.history.host}/projects/${historyId}/blobs/${blobHash}`
  logger.debug(
    { historyId, blobHash },
    'getting blob stream from history service'
  )
  fetchStream(url, getHistoryFetchOptions())
    .then(stream => {
      callback(null, stream)
    })
    .catch(err => callback(OError.tag(err)))
}

export function sendChanges(
  projectId,
  historyId,
  changes,
  endVersion,
  callback
) {
  logger.debug(
    { projectId, historyId, endVersion },
    'sending changes to history service'
  )
  _requestHistoryService(
    {
      path: `projects/${historyId}/legacy_changes`,
      qs: { end_version: endVersion },
      method: 'POST',
      json: changes,
    },
    (error, response) => {
      if (error) {
        OError.tag(error, 'failed to send changes to v1', {
          projectId,
          historyId,
          endVersion,
          errorCode: error.code,
          statusCode: error.statusCode,
          body: error.body,
        })
        return callback(error)
      }
      callback(null, { resyncNeeded: response?.resyncNeeded ?? false })
    }
  )
}

function createBlobFromString(historyId, data, fileId, callback) {
  const stringStream = new StringStream()
  stringStream.push(data)
  stringStream.push(null)
  LocalFileWriter.bufferOnDisk(
    stringStream,
    '',
    fileId,
    (fsPath, cb) => {
      _createBlob(historyId, fsPath, cb)
    },
    (err, hash) => {
      if (err) return callback(OError.tag(err))
      callback(null, hash)
    }
  )
}

function _checkBlobExists(historyId, hash, callback) {
  if (!hash) return callback(null, false)
  const url = `${Settings.overleaf.history.host}/projects/${historyId}/blobs/${hash}`
  fetchNothing(url, {
    method: 'HEAD',
    ...getHistoryFetchOptions(),
  })
    .then(res => {
      callback(null, true)
    })
    .catch(err => {
      if (err instanceof RequestFailedError && err.response.status === 404) {
        return callback(null, false)
      }
      callback(OError.tag(err), false)
    })
}

function _rewriteFilestoreUrl(url, projectId, callback) {
  if (!url) {
    return { fileId: null, filestoreURL: null }
  }
  // Rewrite the filestore url to point to the location in the local
  // settings for this service (this avoids problems with cross-
  // datacentre requests when running filestore in multiple locations).
  const { pathname: fileStorePath } = new URL(url)
  const urlMatch = /^\/project\/([0-9a-f]{24})\/file\/([0-9a-f]{24})$/.exec(
    fileStorePath
  )
  if (urlMatch == null) {
    return callback(new OError('invalid file for blob creation'))
  }
  if (urlMatch[1] !== projectId) {
    return callback(new OError('invalid project for blob creation'))
  }

  const fileId = urlMatch[2]
  const filestoreURL = `${Settings.apis.filestore.url}/project/${projectId}/file/${fileId}`
  return { filestoreURL, fileId }
}

export function createBlobForUpdate(projectId, historyId, update, callback) {
  callback = _.once(callback)

  if (update.doc != null && update.docLines != null) {
    let ranges
    try {
      ranges = HistoryBlobTranslator.createRangeBlobDataFromUpdate(update)
    } catch (error) {
      return callback(OError.tag(error))
    }
    createBlobFromString(
      historyId,
      update.docLines,
      `project-${projectId}-doc-${update.doc}`,
      (err, fileHash) => {
        if (err) {
          return callback(OError.tag(err))
        }
        if (ranges) {
          createBlobFromString(
            historyId,
            JSON.stringify(ranges),
            `project-${projectId}-doc-${update.doc}-ranges`,
            (err, rangesHash) => {
              if (err) {
                return callback(OError.tag(err))
              }
              logger.debug(
                { fileHash, rangesHash },
                'created blobs for both ranges and content'
              )
              return callback(null, { file: fileHash, ranges: rangesHash })
            }
          )
        } else {
          logger.debug({ fileHash }, 'created blob for content')
          return callback(null, { file: fileHash })
        }
      }
    )
  } else if (
    update.file != null &&
    (update.url != null || update.createdBlob)
  ) {
    const { fileId, filestoreURL } = _rewriteFilestoreUrl(
      update.url,
      projectId,
      callback
    )
    _checkBlobExists(historyId, update.hash, (err, blobExists) => {
      if (err) {
        return callback(
          new OError(
            'error checking whether blob exists',
            { projectId, historyId, update },
            err
          )
        )
      } else if (blobExists) {
        logger.debug(
          { projectId, fileId, update },
          'Skipping blob creation as it has already been created'
        )
        return callback(null, { file: update.hash })
      } else if (update.createdBlob) {
        logger.warn(
          { projectId, fileId, update },
          'created blob does not exist, reading from filestore'
        )
      }

      if (!filestoreURL) {
        return callback(
          new OError('no filestore URL provided and blob was not created')
        )
      }
      if (!Settings.apis.filestore.enabled) {
        return callback(new OError('blocking filestore read', { update }))
      }

      fetchStream(filestoreURL, {
        signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT),
      })
        .then(stream => {
          LocalFileWriter.bufferOnDisk(
            stream,
            filestoreURL,
            `project-${projectId}-file-${fileId}`,
            (fsPath, cb) => {
              _createBlob(historyId, fsPath, cb)
            },
            (err, fileHash) => {
              if (err) {
                return callback(OError.tag(err))
              }
              if (update.hash && update.hash !== fileHash) {
                logger.warn(
                  { projectId, fileId, webHash: update.hash, fileHash },
                  'hash mismatch between web and project-history'
                )
              }
              logger.debug({ fileHash }, 'created blob for file')
              callback(null, { file: fileHash })
            }
          )
        })
        .catch(err => {
          if (
            err instanceof RequestFailedError &&
            err.response.status === 404
          ) {
            logger.warn(
              { projectId, historyId, filestoreURL },
              'File contents not found in filestore. Storing in history as an empty file'
            )
            const emptyStream = new StringStream()
            LocalFileWriter.bufferOnDisk(
              emptyStream,
              filestoreURL,
              `project-${projectId}-file-${fileId}`,
              (fsPath, cb) => {
                _createBlob(historyId, fsPath, cb)
              },
              (err, fileHash) => {
                if (err) {
                  return callback(OError.tag(err))
                }
                logger.debug({ fileHash }, 'created empty blob for file')
                callback(null, { file: fileHash })
              }
            )
            emptyStream.push(null) // send an EOF signal
          } else {
            callback(OError.tag(err, 'error from filestore', { filestoreURL }))
          }
        })
    })
  } else {
    const error = new OError('invalid update for blob creation')
    callback(error)
  }
}

function _createBlob(historyId, fsPath, _callback) {
  const callback = _.once(_callback)

  HashManager._getBlobHash(fsPath, (error, hash, byteLength) => {
    if (error) {
      return callback(OError.tag(error))
    }
    const outStream = fs.createReadStream(fsPath)

    logger.debug(
      { fsPath, historyId, hash, byteLength },
      'sending blob to history service'
    )
    const url = `${Settings.overleaf.history.host}/projects/${historyId}/blobs/${hash}`
    fetchNothing(url, {
      method: 'PUT',
      body: outStream,
      headers: { 'Content-Length': byteLength }, // add the content length to work around problems with chunked encoding in node 18
      ...getHistoryFetchOptions(),
    })
      .then(res => {
        callback(null, hash)
      })
      .catch(err => {
        callback(OError.tag(err))
      })
  })
}

export function initializeProject(historyId, callback) {
  _requestHistoryService(
    {
      method: 'POST',
      path: 'projects',
      json: historyId == null ? true : { projectId: historyId },
    },
    (error, project) => {
      if (error) {
        return callback(OError.tag(error))
      }

      const id = project.projectId
      if (id == null) {
        error = new OError('history store did not return a project id', id)
        return callback(error)
      }

      callback(null, id)
    }
  )
}

export function deleteProject(projectId, callback) {
  _requestHistoryService(
    { method: 'DELETE', path: `projects/${projectId}` },
    err => {
      if (err) return callback(OError.tag(err))
      callback(null)
    }
  )
}

const getProjectBlobAsync = promisify(getProjectBlob)

class BlobStore {
  constructor(projectId) {
    this.projectId = projectId
  }

  async getString(hash) {
    return await getProjectBlobAsync(this.projectId, hash)
  }

  async getObject(hash) {
    const string = await this.getString(hash)
    return JSON.parse(string)
  }
}

export function getBlobStore(projectId) {
  return new BlobStore(projectId)
}

function _requestOptions(options) {
  const requestOptions = {
    method: options.method || 'GET',
    url: `${Settings.overleaf.history.host}/${options.path}`,
    timeout: HTTP_REQUEST_TIMEOUT,
    auth: {
      user: Settings.overleaf.history.user,
      pass: Settings.overleaf.history.pass,
      sendImmediately: true,
    },
  }

  if (options.json != null) {
    requestOptions.json = options.json
  }

  if (options.body != null) {
    requestOptions.body = options.body
  }

  if (options.qs != null) {
    requestOptions.qs = options.qs
  }

  return requestOptions
}

/**
 * @return {RequestInit}
 */
function getHistoryFetchOptions() {
  return {
    signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT),
    basicAuth: {
      user: Settings.overleaf.history.user,
      password: Settings.overleaf.history.pass,
    },
  }
}

function _requestHistoryService(options, callback) {
  const requestOptions = _requestOptions(options)
  request(requestOptions, (error, res, body) => {
    if (error) {
      return callback(OError.tag(error))
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      callback(null, body)
    } else {
      const { method, url, qs } = requestOptions
      error = new OError(
        `history store a non-success status code: ${res.statusCode}`,
        { method, url, qs, statusCode: res.statusCode }
      )
      callback(error)
    }
  })
}

export const promises = {
  /** @type {(projectId: string, historyId: string) => Promise<{chunk: import('overleaf-editor-core/lib/types.js').RawChunk}>} */
  getMostRecentChunk: promisify(getMostRecentChunk),
  getChunkAtVersion: promisify(getChunkAtVersion),
  getMostRecentVersion: promisifyMultiResult(getMostRecentVersion, [
    'version',
    'projectStructureAndDocVersions',
    'lastChange',
    'mostRecentChunk',
  ]),
  getMostRecentVersionRaw: promisify(getMostRecentVersionRaw),
  getProjectBlob: promisify(getProjectBlob),
  getProjectBlobStream: promisify(getProjectBlobStream),
  sendChanges: promisify(sendChanges),
  createBlobForUpdate: promisify(createBlobForUpdate),
  initializeProject: promisify(initializeProject),
  deleteProject: promisify(deleteProject),
}
