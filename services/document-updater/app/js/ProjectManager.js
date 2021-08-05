const RedisManager = require('./RedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const DocumentManager = require('./DocumentManager')
const HistoryManager = require('./HistoryManager')
const async = require('async')
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const Errors = require('./Errors')

module.exports = {
  flushProjectWithLocks,
  flushAndDeleteProjectWithLocks,
  queueFlushAndDeleteProject,
  getProjectDocsTimestamps,
  getProjectDocsAndFlushIfOld,
  clearProjectState,
  updateProjectWithLocks,
}

function flushProjectWithLocks(projectId, _callback) {
  const timer = new Metrics.Timer('projectManager.flushProjectWithLocks')
  const callback = function (...args) {
    timer.done()
    _callback(...args)
  }

  RedisManager.getDocIdsInProject(projectId, (error, docIds) => {
    if (error) {
      return callback(error)
    }
    const errors = []
    const jobs = docIds.map(docId => callback => {
      DocumentManager.flushDocIfLoadedWithLock(projectId, docId, error => {
        if (error instanceof Errors.NotFoundError) {
          logger.warn(
            { err: error, projectId, docId },
            'found deleted doc when flushing'
          )
          callback()
        } else if (error) {
          logger.error({ err: error, projectId, docId }, 'error flushing doc')
          errors.push(error)
          callback()
        } else {
          callback()
        }
      })
    })

    logger.log({ projectId, docIds }, 'flushing docs')
    async.series(jobs, () => {
      if (errors.length > 0) {
        callback(new Error('Errors flushing docs. See log for details'))
      } else {
        callback(null)
      }
    })
  })
}

function flushAndDeleteProjectWithLocks(projectId, options, _callback) {
  const timer = new Metrics.Timer(
    'projectManager.flushAndDeleteProjectWithLocks'
  )
  const callback = function (...args) {
    timer.done()
    _callback(...args)
  }

  RedisManager.getDocIdsInProject(projectId, (error, docIds) => {
    if (error) {
      return callback(error)
    }
    const errors = []
    const jobs = docIds.map(docId => callback => {
      DocumentManager.flushAndDeleteDocWithLock(projectId, docId, {}, error => {
        if (error) {
          logger.error({ err: error, projectId, docId }, 'error deleting doc')
          errors.push(error)
        }
        callback()
      })
    })

    logger.log({ projectId, docIds }, 'deleting docs')
    async.series(jobs, () =>
      // When deleting the project here we want to ensure that project
      // history is completely flushed because the project may be
      // deleted in web after this call completes, and so further
      // attempts to flush would fail after that.
      HistoryManager.flushProjectChanges(projectId, options, error => {
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
}

function queueFlushAndDeleteProject(projectId, callback) {
  RedisManager.queueFlushAndDeleteProject(projectId, error => {
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
}

function getProjectDocsTimestamps(projectId, callback) {
  RedisManager.getDocIdsInProject(projectId, (error, docIds) => {
    if (error) {
      return callback(error)
    }
    if (docIds.length === 0) {
      return callback(null, [])
    }
    RedisManager.getDocTimestamps(docIds, (error, timestamps) => {
      if (error) {
        return callback(error)
      }
      callback(null, timestamps)
    })
  })
}

function getProjectDocsAndFlushIfOld(
  projectId,
  projectStateHash,
  excludeVersions,
  _callback
) {
  const timer = new Metrics.Timer('projectManager.getProjectDocsAndFlushIfOld')
  const callback = function (...args) {
    timer.done()
    _callback(...args)
  }

  RedisManager.checkOrSetProjectState(
    projectId,
    projectStateHash,
    (error, projectStateChanged) => {
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
      RedisManager.getDocIdsInProject(projectId, (error, docIds) => {
        if (error) {
          logger.error(
            { err: error, projectId },
            'error getting doc ids in getProjectDocs'
          )
          return callback(error)
        }
        // get the doc lines from redis
        const jobs = docIds.map(docId => cb => {
          DocumentManager.getDocAndFlushIfOldWithLock(
            projectId,
            docId,
            (err, lines, version) => {
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
        })
        async.series(jobs, (error, docs) => {
          if (error) {
            return callback(error)
          }
          callback(null, docs)
        })
      })
    }
  )
}

function clearProjectState(projectId, callback) {
  RedisManager.clearProjectState(projectId, callback)
}

function updateProjectWithLocks(
  projectId,
  projectHistoryId,
  userId,
  updates,
  projectVersion,
  _callback
) {
  const timer = new Metrics.Timer('projectManager.updateProject')
  const callback = function (...args) {
    timer.done()
    _callback(...args)
  }

  let projectSubversion = 0 // project versions can have multiple operations
  let projectOpsLength = 0

  function handleUpdate(update, cb) {
    update.version = `${projectVersion}.${projectSubversion++}`
    switch (update.type) {
      case 'add-doc':
        ProjectHistoryRedisManager.queueAddEntity(
          projectId,
          projectHistoryId,
          'doc',
          update.id,
          userId,
          update,
          (error, count) => {
            projectOpsLength = count
            cb(error)
          }
        )
        break
      case 'rename-doc':
        DocumentManager.renameDocWithLock(
          projectId,
          update.id,
          userId,
          update,
          projectHistoryId,
          (error, count) => {
            projectOpsLength = count
            cb(error)
          }
        )
        break
      case 'add-file':
        ProjectHistoryRedisManager.queueAddEntity(
          projectId,
          projectHistoryId,
          'file',
          update.id,
          userId,
          update,
          (error, count) => {
            projectOpsLength = count
            cb(error)
          }
        )
        break
      case 'rename-file':
        ProjectHistoryRedisManager.queueRenameEntity(
          projectId,
          projectHistoryId,
          'file',
          update.id,
          userId,
          update,
          (error, count) => {
            projectOpsLength = count
            cb(error)
          }
        )
        break
      default:
        cb(new Error(`Unknown update type: ${update.type}`))
    }
  }

  async.eachSeries(updates, handleUpdate, error => {
    if (error) {
      return callback(error)
    }
    if (
      HistoryManager.shouldFlushHistoryOps(
        projectOpsLength,
        updates.length,
        HistoryManager.FLUSH_PROJECT_EVERY_N_OPS
      )
    ) {
      HistoryManager.flushProjectChangesAsync(projectId)
    }
    callback()
  })
}
