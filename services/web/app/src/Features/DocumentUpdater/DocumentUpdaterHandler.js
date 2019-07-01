/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocumentUpdaterHandler
let request = require('request')
request = request.defaults()
const settings = require('settings-sharelatex')
const _ = require('underscore')
const async = require('async')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const { Project } = require('../../models/Project')

module.exports = DocumentUpdaterHandler = {
  flushProjectToMongo(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id }, 'flushing project from document updater')
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/flush`,
        method: 'POST'
      },
      project_id,
      'flushing.mongo.project',
      callback
    )
  },

  flushMultipleProjectsToMongo(project_ids, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const jobs = []
    for (let project_id of Array.from(project_ids)) {
      ;(project_id =>
        jobs.push(callback =>
          DocumentUpdaterHandler.flushProjectToMongo(project_id, callback)
        ))(project_id)
    }
    return async.series(jobs, callback)
  },

  flushProjectToMongoAndDelete(project_id, callback) {
    if (callback == null) {
      callback = function() {}
    }
    const timer = new metrics.Timer('delete.mongo.project')
    const url = `${settings.apis.documentupdater.url}`
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}`,
        method: 'DELETE'
      },
      project_id,
      'flushing.mongo.project',
      callback
    )
  },

  flushDocToMongo(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id, doc_id }, 'flushing doc from document updater')
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/doc/${doc_id}/flush`,
        method: 'POST'
      },
      project_id,
      'flushing.mongo.doc',
      callback
    )
  },

  deleteDoc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log({ project_id, doc_id }, 'deleting doc from document updater')
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/doc/${doc_id}`,
        method: 'DELETE'
      },
      project_id,
      'delete.mongo.doc',
      callback
    )
  },

  getDocument(project_id, doc_id, fromVersion, callback) {
    if (callback == null) {
      callback = function(error, doclines, version, ranges, ops) {}
    }
    logger.log({ project_id, doc_id }, 'getting doc from document updater')
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/doc/${doc_id}?fromVersion=${fromVersion}`,
        json: true
      },
      project_id,
      'get-document',
      function(error, doc) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, doc.lines, doc.version, doc.ranges, doc.ops)
      }
    )
  },

  setDocument(project_id, doc_id, user_id, docLines, source, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log(
      { project_id, doc_id, source, user_id },
      'setting doc in document updater'
    )
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/doc/${doc_id}`,
        method: 'POST',
        json: {
          lines: docLines,
          source,
          user_id
        }
      },
      project_id,
      'set-document',
      callback
    )
  },

  getProjectDocsIfMatch(project_id, projectStateHash, callback) {
    // If the project state hasn't changed, we can get all the latest
    // docs from redis via the docupdater. Otherwise we will need to
    // fall back to getting them from mongo.
    if (callback == null) {
      callback = function(error, docs) {}
    }
    const timer = new metrics.Timer('get-project-docs')
    const url = `${
      settings.apis.documentupdater.url
    }/project/${project_id}/get_and_flush_if_old?state=${projectStateHash}`
    logger.log({ project_id }, 'getting project docs from document updater')
    return request.post(url, function(error, res, body) {
      timer.done()
      if (error != null) {
        logger.warn(
          { err: error, url, project_id },
          'error getting project docs from doc updater'
        )
        return callback(error)
      }
      if (res.statusCode === 409) {
        // HTTP response code "409 Conflict"
        // Docupdater has checked the projectStateHash and found that
        // it has changed. This means that the docs currently in redis
        // aren't the only change to the project and the full set of
        // docs/files should be retreived from docstore/filestore
        // instead.
        return callback()
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        let docs
        logger.log(
          { project_id },
          'got project docs from document document updater'
        )
        try {
          docs = JSON.parse(body)
        } catch (error1) {
          error = error1
          return callback(error)
        }
        return callback(null, docs)
      } else {
        logger.warn(
          { project_id, url },
          `doc updater returned a non-success status code: ${res.statusCode}`
        )
        return callback(
          new Error(
            `doc updater returned a non-success status code: ${res.statusCode}`
          )
        )
      }
    })
  },

  clearProjectState(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id }, 'clearing project state from document updater')

    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/clearState`,
        method: 'POST'
      },
      project_id,
      'clear-project-state',
      callback
    )
  },

  acceptChanges(project_id, doc_id, change_ids, callback) {
    if (change_ids == null) {
      change_ids = []
    }
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id, doc_id }, `accepting ${change_ids.length} changes`)

    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/doc/${doc_id}/change/accept`,
        json: {
          change_ids
        },
        method: 'POST'
      },
      project_id,
      'accept-changes',
      callback
    )
  },

  deleteThread(project_id, doc_id, thread_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const timer = new metrics.Timer('delete-thread')
    logger.log(
      { project_id, doc_id, thread_id },
      'deleting comment range in document updater'
    )
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/doc/${doc_id}/comment/${thread_id}`,
        method: 'DELETE'
      },
      project_id,
      'delete-thread',
      callback
    )
  },

  resyncProjectHistory(project_id, projectHistoryId, docs, files, callback) {
    logger.info(
      { project_id, docs, files },
      'resyncing project history in doc updater'
    )
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}/history/resync`,
        json: { docs, files, projectHistoryId },
        method: 'POST'
      },
      project_id,
      'resync-project-history',
      callback
    )
  },

  updateProjectStructure(
    project_id,
    projectHistoryId,
    userId,
    changes,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    if (
      !(settings.apis.project_history != null
        ? settings.apis.project_history.sendProjectStructureOps
        : undefined)
    ) {
      return callback()
    }

    const docUpdates = DocumentUpdaterHandler._getUpdates(
      'doc',
      changes.oldDocs,
      changes.newDocs
    )
    const fileUpdates = DocumentUpdaterHandler._getUpdates(
      'file',
      changes.oldFiles,
      changes.newFiles
    )
    const projectVersion = __guard__(
      changes != null ? changes.newProject : undefined,
      x => x.version
    )

    if (docUpdates.length + fileUpdates.length < 1) {
      return callback()
    }

    if (projectVersion == null) {
      logger.warn(
        { project_id, changes, projectVersion },
        'did not receive project version in changes'
      )
      return callback(new Error('did not receive project version in changes'))
    }

    logger.log({ project_id }, 'updating project structure in doc updater')
    return DocumentUpdaterHandler._makeRequest(
      {
        path: `/project/${project_id}`,
        json: {
          docUpdates,
          fileUpdates,
          userId,
          version: projectVersion,
          projectHistoryId
        },
        method: 'POST'
      },
      project_id,
      'update-project-structure',
      callback
    )
  },

  _makeRequest(options, project_id, metricsKey, callback) {
    const timer = new metrics.Timer(metricsKey)
    return request(
      {
        url: `${settings.apis.documentupdater.url}${options.path}`,
        json: options.json,
        method: options.method || 'GET'
      },
      function(error, res, body) {
        timer.done()
        if (error != null) {
          logger.warn(
            { error, project_id },
            'error making request to document updater'
          )
          return callback(error)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body)
        } else {
          error = new Error(
            `document updater returned a failure status code: ${res.statusCode}`
          )
          logger.warn(
            { error, project_id },
            `document updater returned failure status code: ${res.statusCode}`
          )
          return callback(error)
        }
      }
    )
  },

  _getUpdates(entityType, oldEntities, newEntities) {
    let id, newEntity, oldEntity
    if (!oldEntities) {
      oldEntities = []
    }
    if (!newEntities) {
      newEntities = []
    }
    const updates = []

    const oldEntitiesHash = _.indexBy(oldEntities, entity =>
      entity[entityType]._id.toString()
    )
    const newEntitiesHash = _.indexBy(newEntities, entity =>
      entity[entityType]._id.toString()
    )

    // Send deletes before adds (and renames) to keep a 1:1 mapping between
    // paths and ids
    //
    // When a file is replaced, we first delete the old file and then add the
    // new file. If the 'add' operation is sent to project history before the
    // 'delete' then we would have two files with the same path at that point
    // in time.
    for (id in oldEntitiesHash) {
      oldEntity = oldEntitiesHash[id]
      newEntity = newEntitiesHash[id]

      if (newEntity == null) {
        // entity deleted
        updates.push({
          id,
          pathname: oldEntity.path,
          newPathname: ''
        })
      }
    }

    for (id in newEntitiesHash) {
      newEntity = newEntitiesHash[id]
      oldEntity = oldEntitiesHash[id]

      if (oldEntity == null) {
        // entity added
        updates.push({
          id,
          pathname: newEntity.path,
          docLines: newEntity.docLines,
          url: newEntity.url,
          hash: newEntity.file != null ? newEntity.file.hash : undefined
        })
      } else if (newEntity.path !== oldEntity.path) {
        // entity renamed
        updates.push({
          id,
          pathname: oldEntity.path,
          newPathname: newEntity.path
        })
      }
    }

    return updates
  }
}

const PENDINGUPDATESKEY = 'PendingUpdates'
const DOCLINESKEY = 'doclines'
const DOCIDSWITHPENDINGUPDATES = 'DocsWithPendingUpdates'

const keys = {
  pendingUpdates(op) {
    return `${PENDINGUPDATESKEY}:${op.doc_id}`
  },
  docsWithPendingUpdates: DOCIDSWITHPENDINGUPDATES,
  docLines(op) {
    return `${DOCLINESKEY}:${op.doc_id}`
  },
  combineProjectIdAndDocId(project_id, doc_id) {
    return `${project_id}:${doc_id}`
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
