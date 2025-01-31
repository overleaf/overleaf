const request = require('request').defaults({ timeout: 30 * 1000 })
const OError = require('@overleaf/o-error')
const settings = require('@overleaf/settings')
const _ = require('lodash')
const async = require('async')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const { promisify } = require('util')
const { promisifyMultiResult } = require('@overleaf/promise-utils')
const ProjectGetter = require('../Project/ProjectGetter')
const FileStoreHandler = require('../FileStore/FileStoreHandler')
const Features = require('../../infrastructure/Features')

/**
 * @param {string} projectId
 */
function flushProjectToMongo(projectId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/flush`,
      method: 'POST',
    },
    projectId,
    'flushing.mongo.project',
    callback
  )
}

function flushMultipleProjectsToMongo(projectIds, callback) {
  const jobs = projectIds.map(projectId => callback => {
    flushProjectToMongo(projectId, callback)
  })
  async.series(jobs, callback)
}

/**
 * @param {string} projectId
 */
function flushProjectToMongoAndDelete(projectId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}`,
      method: 'DELETE',
    },
    projectId,
    'flushing.mongo.project',
    callback
  )
}

function flushDocToMongo(projectId, docId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}/flush`,
      method: 'POST',
    },
    projectId,
    'flushing.mongo.doc',
    callback
  )
}

function deleteDoc(projectId, docId, ignoreFlushErrors, callback) {
  if (typeof ignoreFlushErrors === 'function') {
    callback = ignoreFlushErrors
    ignoreFlushErrors = false
  }
  let path = `/project/${projectId}/doc/${docId}`
  if (ignoreFlushErrors) {
    path += '?ignore_flush_errors=true'
  }
  const method = 'DELETE'
  _makeRequest(
    {
      path,
      method,
    },
    projectId,
    'delete.mongo.doc',
    callback
  )
}

function getComment(projectId, docId, commentId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}/comment/${commentId}`,
      json: true,
    },
    projectId,
    'get-comment',
    function (error, comment) {
      if (error) {
        return callback(error)
      }
      callback(null, comment)
    }
  )
}

function getDocument(projectId, docId, fromVersion, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}?fromVersion=${fromVersion}`,
      json: true,
    },
    projectId,
    'get-document',
    function (error, doc) {
      if (error) {
        return callback(error)
      }
      callback(null, doc.lines, doc.version, doc.ranges, doc.ops)
    }
  )
}

function setDocument(projectId, docId, userId, docLines, source, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}`,
      method: 'POST',
      json: {
        lines: docLines,
        source,
        user_id: userId,
      },
    },
    projectId,
    'set-document',
    callback
  )
}

function appendToDocument(projectId, docId, userId, lines, source, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}/append`,
      method: 'POST',
      json: {
        lines,
        source,
        user_id: userId,
      },
    },
    projectId,
    'append-to-document',
    callback
  )
}

function getProjectDocsIfMatch(projectId, projectStateHash, callback) {
  // If the project state hasn't changed, we can get all the latest
  // docs from redis via the docupdater. Otherwise we will need to
  // fall back to getting them from mongo.
  const timer = new metrics.Timer('get-project-docs')
  const url = `${settings.apis.documentupdater.url}/project/${projectId}/get_and_flush_if_old?state=${projectStateHash}`
  request.post(url, function (error, res, body) {
    timer.done()
    if (error) {
      OError.tag(error, 'error getting project docs from doc updater', {
        url,
        projectId,
      })
      return callback(error)
    }
    if (res.statusCode === 409) {
      // HTTP response code "409 Conflict"
      // Docupdater has checked the projectStateHash and found that
      // it has changed. This means that the docs currently in redis
      // aren't the only change to the project and the full set of
      // docs/files should be retreived from docstore/filestore
      // instead.
      callback()
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      let docs
      try {
        docs = JSON.parse(body)
      } catch (error1) {
        return callback(OError.tag(error1))
      }
      callback(null, docs)
    } else {
      callback(
        new OError(
          `doc updater returned a non-success status code: ${res.statusCode}`,
          {
            projectId,
            url,
          }
        )
      )
    }
  })
}

function clearProjectState(projectId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/clearState`,
      method: 'POST',
    },
    projectId,
    'clear-project-state',
    callback
  )
}

function acceptChanges(projectId, docId, changeIds, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}/change/accept`,
      json: { change_ids: changeIds },
      method: 'POST',
    },
    projectId,
    'accept-changes',
    callback
  )
}

function resolveThread(projectId, docId, threadId, userId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}/comment/${threadId}/resolve`,
      method: 'POST',
      json: {
        user_id: userId,
      },
    },
    projectId,
    'resolve-thread',
    callback
  )
}

function reopenThread(projectId, docId, threadId, userId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}/comment/${threadId}/reopen`,
      method: 'POST',
      json: {
        user_id: userId,
      },
    },
    projectId,
    'reopen-thread',
    callback
  )
}

function deleteThread(projectId, docId, threadId, userId, callback) {
  _makeRequest(
    {
      path: `/project/${projectId}/doc/${docId}/comment/${threadId}`,
      method: 'DELETE',
      json: {
        user_id: userId,
      },
    },
    projectId,
    'delete-thread',
    callback
  )
}

function resyncProjectHistory(
  projectId,
  projectHistoryId,
  docs,
  files,
  opts,
  callback
) {
  docs = docs.map(doc => ({
    doc: doc.doc._id,
    path: doc.path,
  }))
  const hasFilestore = Features.hasFeature('filestore')
  if (!hasFilestore) {
    // Files without a hash likely do not have a blob. Abort.
    for (const { file } of files) {
      if (!file.hash) {
        return callback(
          new OError('found file with missing hash', { projectId, file })
        )
      }
    }
  }
  files = files.map(file => ({
    file: file.file._id,
    path: file.path,
    url: hasFilestore
      ? FileStoreHandler._buildUrl(projectId, file.file._id)
      : undefined,
    _hash: file.file.hash,
    createdBlob: !hasFilestore,
    metadata: buildFileMetadataForHistory(file.file),
  }))

  const body = { docs, files, projectHistoryId }
  if (opts.historyRangesMigration) {
    body.historyRangesMigration = opts.historyRangesMigration
  }
  if (opts.resyncProjectStructureOnly) {
    body.resyncProjectStructureOnly = opts.resyncProjectStructureOnly
  }
  _makeRequest(
    {
      path: `/project/${projectId}/history/resync`,
      json: body,
      method: 'POST',
      timeout: 6 * 60 * 1000, // allow 6 minutes for resync
    },
    projectId,
    'resync-project-history',
    callback
  )
}

/**
 * Block a project from being loaded in docupdater
 *
 * @param {string} projectId
 * @param {Callback} callback
 */
function blockProject(projectId, callback) {
  _makeRequest(
    { path: `/project/${projectId}/block`, method: 'POST', json: true },
    projectId,
    'block-project',
    (err, body) => {
      if (err) {
        return callback(err)
      }
      callback(null, body.blocked)
    }
  )
}

/**
 * Unblock a previously blocked project
 *
 * @param {string} projectId
 * @param {Callback} callback
 */
function unblockProject(projectId, callback) {
  _makeRequest(
    { path: `/project/${projectId}/unblock`, method: 'POST', json: true },
    projectId,
    'unblock-project',
    (err, body) => {
      if (err) {
        return callback(err)
      }
      callback(null, body.wasBlocked)
    }
  )
}

function updateProjectStructure(
  projectId,
  projectHistoryId,
  userId,
  changes,
  source,
  callback
) {
  if (
    settings.apis.project_history == null ||
    !settings.apis.project_history.sendProjectStructureOps
  ) {
    return callback()
  }

  ProjectGetter.getProjectWithoutLock(
    projectId,
    { overleaf: true },
    (err, project) => {
      if (err) {
        return callback(err)
      }
      const historyRangesSupport = _.get(
        project,
        'overleaf.history.rangesSupportEnabled',
        false
      )
      const {
        deletes: docDeletes,
        adds: docAdds,
        renames: docRenames,
      } = _getUpdates(
        'doc',
        changes.oldDocs,
        changes.newDocs,
        historyRangesSupport
      )
      const hasFilestore = Features.hasFeature('filestore')
      if (!hasFilestore) {
        for (const newEntity of changes.newFiles || []) {
          if (!newEntity.file.hash) {
            // Files without a hash likely do not have a blob. Abort.
            return callback(
              new OError('found file with missing hash', { newEntity })
            )
          }
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
        return callback()
      }

      if (projectVersion == null) {
        logger.warn(
          { projectId, changes, projectVersion },
          'did not receive project version in changes'
        )
        return callback(new Error('did not receive project version in changes'))
      }

      _makeRequest(
        {
          path: `/project/${projectId}`,
          json: {
            updates,
            userId,
            version: projectVersion,
            projectHistoryId,
            source,
          },
          method: 'POST',
        },
        projectId,
        'update-project-structure',
        callback
      )
    }
  )
}

function _makeRequest(options, projectId, metricsKey, callback) {
  const timer = new metrics.Timer(metricsKey)
  request(
    {
      url: `${settings.apis.documentupdater.url}${options.path}`,
      json: options.json,
      method: options.method || 'GET',
      timeout: options.timeout || 30 * 1000,
    },
    function (error, res, body) {
      timer.done()
      if (error) {
        logger.warn(
          { error, projectId },
          'error making request to document updater'
        )
        callback(error)
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        callback(null, body)
      } else {
        error = new Error(
          `document updater returned a failure status code: ${res.statusCode}`
        )
        logger.warn(
          { error, projectId },
          `document updater returned failure status code: ${res.statusCode}`
        )
        callback(error)
      }
    }
  )
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
  const hasFilestore = Features.hasFeature('filestore')

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
        url: newEntity.file != null && hasFilestore ? newEntity.url : undefined,
        hash: newEntity.file != null ? newEntity.file.hash : undefined,
        metadata: buildFileMetadataForHistory(newEntity.file),
        createdBlob: (newEntity.createdBlob || !hasFilestore) ?? false,
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

module.exports = {
  flushProjectToMongo,
  flushMultipleProjectsToMongo,
  flushProjectToMongoAndDelete,
  flushDocToMongo,
  deleteDoc,
  getComment,
  getDocument,
  setDocument,
  appendToDocument,
  getProjectDocsIfMatch,
  clearProjectState,
  acceptChanges,
  resolveThread,
  reopenThread,
  deleteThread,
  resyncProjectHistory,
  blockProject,
  unblockProject,
  updateProjectStructure,
  promises: {
    flushProjectToMongo: promisify(flushProjectToMongo),
    flushMultipleProjectsToMongo: promisify(flushMultipleProjectsToMongo),
    flushProjectToMongoAndDelete: promisify(flushProjectToMongoAndDelete),
    flushDocToMongo: promisify(flushDocToMongo),
    deleteDoc: promisify(deleteDoc),
    getComment: promisify(getComment),
    getDocument: promisifyMultiResult(getDocument, [
      'lines',
      'version',
      'ranges',
      'ops',
    ]),
    setDocument: promisify(setDocument),
    getProjectDocsIfMatch: promisify(getProjectDocsIfMatch),
    clearProjectState: promisify(clearProjectState),
    acceptChanges: promisify(acceptChanges),
    resolveThread: promisify(resolveThread),
    reopenThread: promisify(reopenThread),
    deleteThread: promisify(deleteThread),
    resyncProjectHistory: promisify(resyncProjectHistory),
    blockProject: promisify(blockProject),
    unblockProject: promisify(unblockProject),
    updateProjectStructure: promisify(updateProjectStructure),
    appendToDocument: promisify(appendToDocument),
  },
}
