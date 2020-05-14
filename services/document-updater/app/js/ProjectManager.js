/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
let ProjectManager
const RedisManager = require('./RedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const DocumentManager = require('./DocumentManager')
const HistoryManager = require('./HistoryManager')
const async = require('async')
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const Errors = require('./Errors')

module.exports = ProjectManager = {
  flushProjectWithLocks(project_id, _callback) {
    const timer = new Metrics.Timer('projectManager.flushProjectWithLocks')
    const callback = function (...args) {
      timer.done()
      _callback(...args)
    }

    RedisManager.getDocIdsInProject(project_id, function (error, doc_ids) {
      if (error) {
        return callback(error)
      }
      const jobs = []
      const errors = []
      for (const doc_id of doc_ids) {
        ;((doc_id) =>
          jobs.push((callback) =>
            DocumentManager.flushDocIfLoadedWithLock(
              project_id,
              doc_id,
              function (error) {
                if (error instanceof Errors.NotFoundError) {
                  logger.warn(
                    { err: error, project_id, doc_id },
                    'found deleted doc when flushing'
                  )
                  callback()
                } else if (error) {
                  logger.error(
                    { err: error, project_id, doc_id },
                    'error flushing doc'
                  )
                  errors.push(error)
                  callback()
                } else {
                  callback()
                }
              }
            )
          ))(doc_id)
      }

      logger.log({ project_id, doc_ids }, 'flushing docs')
      async.series(jobs, function () {
        if (errors.length > 0) {
          callback(new Error('Errors flushing docs. See log for details'))
        } else {
          callback(null)
        }
      })
    })
  },

  flushAndDeleteProjectWithLocks(project_id, options, _callback) {
    const timer = new Metrics.Timer(
      'projectManager.flushAndDeleteProjectWithLocks'
    )
    const callback = function (...args) {
      timer.done()
      _callback(...args)
    }

    RedisManager.getDocIdsInProject(project_id, function (error, doc_ids) {
      if (error) {
        return callback(error)
      }
      const jobs = []
      const errors = []
      for (const doc_id of doc_ids) {
        ;((doc_id) =>
          jobs.push((callback) =>
            DocumentManager.flushAndDeleteDocWithLock(
              project_id,
              doc_id,
              {},
              function (error) {
                if (error) {
                  logger.error(
                    { err: error, project_id, doc_id },
                    'error deleting doc'
                  )
                  errors.push(error)
                }
                callback()
              }
            )
          ))(doc_id)
      }

      logger.log({ project_id, doc_ids }, 'deleting docs')
      async.series(jobs, () =>
        // When deleting the project here we want to ensure that project
        // history is completely flushed because the project may be
        // deleted in web after this call completes, and so further
        // attempts to flush would fail after that.
        HistoryManager.flushProjectChanges(project_id, options, function (
          error
        ) {
          if (errors.length > 0) {
            callback(new Error('Errors deleting docs. See log for details'))
          } else if (error) {
            callback(error)
          } else {
            callback(null)
          }
        })
      )
    })
  },

  queueFlushAndDeleteProject(project_id, callback) {
    RedisManager.queueFlushAndDeleteProject(project_id, function (error) {
      if (error) {
        logger.error(
          { project_id, error },
          'error adding project to flush and delete queue'
        )
        return callback(error)
      }
      Metrics.inc('queued-delete')
      callback()
    })
  },

  getProjectDocsTimestamps(project_id, callback) {
    RedisManager.getDocIdsInProject(project_id, function (error, doc_ids) {
      if (error) {
        return callback(error)
      }
      if (doc_ids.length === 0) {
        return callback(null, [])
      }
      RedisManager.getDocTimestamps(doc_ids, function (error, timestamps) {
        if (error) {
          return callback(error)
        }
        callback(null, timestamps)
      })
    })
  },

  getProjectDocsAndFlushIfOld(
    project_id,
    projectStateHash,
    excludeVersions,
    _callback
  ) {
    const timer = new Metrics.Timer(
      'projectManager.getProjectDocsAndFlushIfOld'
    )
    const callback = function (...args) {
      timer.done()
      _callback(...args)
    }

    RedisManager.checkOrSetProjectState(project_id, projectStateHash, function (
      error,
      projectStateChanged
    ) {
      if (error) {
        logger.error(
          { err: error, project_id },
          'error getting/setting project state in getProjectDocsAndFlushIfOld'
        )
        return callback(error)
      }
      // we can't return docs if project structure has changed
      if (projectStateChanged) {
        return callback(
          Errors.ProjectStateChangedError('project state changed')
        )
      }
      // project structure hasn't changed, return doc content from redis
      RedisManager.getDocIdsInProject(project_id, function (error, doc_ids) {
        if (error) {
          logger.error(
            { err: error, project_id },
            'error getting doc ids in getProjectDocs'
          )
          return callback(error)
        }
        const jobs = []
        for (const doc_id of doc_ids) {
          ;((doc_id) =>
            jobs.push((
              cb // get the doc lines from redis
            ) =>
              DocumentManager.getDocAndFlushIfOldWithLock(
                project_id,
                doc_id,
                function (err, lines, version) {
                  if (err) {
                    logger.error(
                      { err, project_id, doc_id },
                      'error getting project doc lines in getProjectDocsAndFlushIfOld'
                    )
                    return cb(err)
                  }
                  const doc = { _id: doc_id, lines, v: version } // create a doc object to return
                  cb(null, doc)
                }
              )
            ))(doc_id)
        }
        async.series(jobs, function (error, docs) {
          if (error) {
            return callback(error)
          }
          callback(null, docs)
        })
      })
    })
  },

  clearProjectState(project_id, callback) {
    RedisManager.clearProjectState(project_id, callback)
  },

  updateProjectWithLocks(
    project_id,
    projectHistoryId,
    user_id,
    docUpdates,
    fileUpdates,
    version,
    _callback
  ) {
    const timer = new Metrics.Timer('projectManager.updateProject')
    const callback = function (...args) {
      timer.done()
      _callback(...args)
    }

    const project_version = version
    let project_subversion = 0 // project versions can have multiple operations

    let project_ops_length = 0

    const handleDocUpdate = function (projectUpdate, cb) {
      const doc_id = projectUpdate.id
      projectUpdate.version = `${project_version}.${project_subversion++}`
      if (projectUpdate.docLines != null) {
        ProjectHistoryRedisManager.queueAddEntity(
          project_id,
          projectHistoryId,
          'doc',
          doc_id,
          user_id,
          projectUpdate,
          function (error, count) {
            project_ops_length = count
            cb(error)
          }
        )
      } else {
        DocumentManager.renameDocWithLock(
          project_id,
          doc_id,
          user_id,
          projectUpdate,
          projectHistoryId,
          function (error, count) {
            project_ops_length = count
            cb(error)
          }
        )
      }
    }

    const handleFileUpdate = function (projectUpdate, cb) {
      const file_id = projectUpdate.id
      projectUpdate.version = `${project_version}.${project_subversion++}`
      if (projectUpdate.url != null) {
        ProjectHistoryRedisManager.queueAddEntity(
          project_id,
          projectHistoryId,
          'file',
          file_id,
          user_id,
          projectUpdate,
          function (error, count) {
            project_ops_length = count
            cb(error)
          }
        )
      } else {
        ProjectHistoryRedisManager.queueRenameEntity(
          project_id,
          projectHistoryId,
          'file',
          file_id,
          user_id,
          projectUpdate,
          function (error, count) {
            project_ops_length = count
            cb(error)
          }
        )
      }
    }

    async.eachSeries(docUpdates, handleDocUpdate, function (error) {
      if (error) {
        return callback(error)
      }
      async.eachSeries(fileUpdates, handleFileUpdate, function (error) {
        if (error) {
          return callback(error)
        }
        if (
          HistoryManager.shouldFlushHistoryOps(
            project_ops_length,
            docUpdates.length + fileUpdates.length,
            HistoryManager.FLUSH_PROJECT_EVERY_N_OPS
          )
        ) {
          HistoryManager.flushProjectChangesAsync(project_id)
        }
        callback()
      })
    })
  },
}
