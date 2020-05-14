const RedisManager = require('./RedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const DocumentManager = require('./DocumentManager')
const HistoryManager = require('./HistoryManager')
const async = require('async')
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const Errors = require('./Errors')

module.exports = {
  flushProjectWithLocks(projectId, _callback) {
    const timer = new Metrics.Timer('projectManager.flushProjectWithLocks')
    const callback = function (...args) {
      timer.done()
      _callback(...args)
    }

    RedisManager.getDocIdsInProject(projectId, function (error, docIds) {
      if (error) {
        return callback(error)
      }
      const jobs = []
      const errors = []
      for (const docId of docIds) {
        ;((docId) =>
          jobs.push((callback) =>
            DocumentManager.flushDocIfLoadedWithLock(
              projectId,
              docId,
              function (error) {
                if (error instanceof Errors.NotFoundError) {
                  logger.warn(
                    { err: error, projectId, docId },
                    'found deleted doc when flushing'
                  )
                  callback()
                } else if (error) {
                  logger.error(
                    { err: error, projectId, docId },
                    'error flushing doc'
                  )
                  errors.push(error)
                  callback()
                } else {
                  callback()
                }
              }
            )
          ))(docId)
      }

      logger.log({ projectId, docIds }, 'flushing docs')
      async.series(jobs, function () {
        if (errors.length > 0) {
          callback(new Error('Errors flushing docs. See log for details'))
        } else {
          callback(null)
        }
      })
    })
  },

  flushAndDeleteProjectWithLocks(projectId, options, _callback) {
    const timer = new Metrics.Timer(
      'projectManager.flushAndDeleteProjectWithLocks'
    )
    const callback = function (...args) {
      timer.done()
      _callback(...args)
    }

    RedisManager.getDocIdsInProject(projectId, function (error, docIds) {
      if (error) {
        return callback(error)
      }
      const jobs = []
      const errors = []
      for (const docId of docIds) {
        ;((docId) =>
          jobs.push((callback) =>
            DocumentManager.flushAndDeleteDocWithLock(
              projectId,
              docId,
              {},
              function (error) {
                if (error) {
                  logger.error(
                    { err: error, projectId, docId },
                    'error deleting doc'
                  )
                  errors.push(error)
                }
                callback()
              }
            )
          ))(docId)
      }

      logger.log({ projectId, docIds }, 'deleting docs')
      async.series(jobs, () =>
        // When deleting the project here we want to ensure that project
        // history is completely flushed because the project may be
        // deleted in web after this call completes, and so further
        // attempts to flush would fail after that.
        HistoryManager.flushProjectChanges(projectId, options, function (
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

  queueFlushAndDeleteProject(projectId, callback) {
    RedisManager.queueFlushAndDeleteProject(projectId, function (error) {
      if (error) {
        logger.error(
          { projectId, error },
          'error adding project to flush and delete queue'
        )
        return callback(error)
      }
      Metrics.inc('queued-delete')
      callback()
    })
  },

  getProjectDocsTimestamps(projectId, callback) {
    RedisManager.getDocIdsInProject(projectId, function (error, docIds) {
      if (error) {
        return callback(error)
      }
      if (docIds.length === 0) {
        return callback(null, [])
      }
      RedisManager.getDocTimestamps(docIds, function (error, timestamps) {
        if (error) {
          return callback(error)
        }
        callback(null, timestamps)
      })
    })
  },

  getProjectDocsAndFlushIfOld(
    projectId,
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

    RedisManager.checkOrSetProjectState(projectId, projectStateHash, function (
      error,
      projectStateChanged
    ) {
      if (error) {
        logger.error(
          { err: error, projectId },
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
      RedisManager.getDocIdsInProject(projectId, function (error, docIds) {
        if (error) {
          logger.error(
            { err: error, projectId },
            'error getting doc ids in getProjectDocs'
          )
          return callback(error)
        }
        const jobs = []
        for (const docId of docIds) {
          ;((docId) =>
            jobs.push((
              cb // get the doc lines from redis
            ) =>
              DocumentManager.getDocAndFlushIfOldWithLock(
                projectId,
                docId,
                function (err, lines, version) {
                  if (err) {
                    logger.error(
                      { err, projectId, docId },
                      'error getting project doc lines in getProjectDocsAndFlushIfOld'
                    )
                    return cb(err)
                  }
                  const doc = { _id: docId, lines, v: version } // create a doc object to return
                  cb(null, doc)
                }
              )
            ))(docId)
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

  clearProjectState(projectId, callback) {
    RedisManager.clearProjectState(projectId, callback)
  },

  updateProjectWithLocks(
    projectId,
    projectHistoryId,
    userId,
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

    const projectVersion = version
    let projectSubversion = 0 // project versions can have multiple operations

    let projectOpsLength = 0

    const handleDocUpdate = function (projectUpdate, cb) {
      const docId = projectUpdate.id
      projectUpdate.version = `${projectVersion}.${projectSubversion++}`
      if (projectUpdate.docLines != null) {
        ProjectHistoryRedisManager.queueAddEntity(
          projectId,
          projectHistoryId,
          'doc',
          docId,
          userId,
          projectUpdate,
          function (error, count) {
            projectOpsLength = count
            cb(error)
          }
        )
      } else {
        DocumentManager.renameDocWithLock(
          projectId,
          docId,
          userId,
          projectUpdate,
          projectHistoryId,
          function (error, count) {
            projectOpsLength = count
            cb(error)
          }
        )
      }
    }

    const handleFileUpdate = function (projectUpdate, cb) {
      const fileId = projectUpdate.id
      projectUpdate.version = `${projectVersion}.${projectSubversion++}`
      if (projectUpdate.url != null) {
        ProjectHistoryRedisManager.queueAddEntity(
          projectId,
          projectHistoryId,
          'file',
          fileId,
          userId,
          projectUpdate,
          function (error, count) {
            projectOpsLength = count
            cb(error)
          }
        )
      } else {
        ProjectHistoryRedisManager.queueRenameEntity(
          projectId,
          projectHistoryId,
          'file',
          fileId,
          userId,
          projectUpdate,
          function (error, count) {
            projectOpsLength = count
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
            projectOpsLength,
            docUpdates.length + fileUpdates.length,
            HistoryManager.FLUSH_PROJECT_EVERY_N_OPS
          )
        ) {
          HistoryManager.flushProjectChangesAsync(projectId)
        }
        callback()
      })
    })
  },
}
