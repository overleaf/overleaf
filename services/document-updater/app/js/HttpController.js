const DocumentManager = require('./DocumentManager')
const HistoryManager = require('./HistoryManager')
const ProjectManager = require('./ProjectManager')
const Errors = require('./Errors')
const logger = require('logger-sharelatex')
const Settings = require('@overleaf/settings')
const Metrics = require('./Metrics')
const ProjectFlusher = require('./ProjectFlusher')
const DeleteQueueManager = require('./DeleteQueueManager')
const async = require('async')

module.exports = {
  getDoc,
  getProjectDocsAndFlushIfOld,
  clearProjectState,
  setDoc,
  flushDocIfLoaded,
  deleteDoc,
  flushProject,
  deleteProject,
  deleteMultipleProjects,
  acceptChanges,
  deleteComment,
  updateProject,
  resyncProjectHistory,
  flushAllProjects,
  flushQueuedProjects,
}

function getDoc(req, res, next) {
  let fromVersion
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  logger.log({ projectId, docId }, 'getting doc via http')
  const timer = new Metrics.Timer('http.getDoc')

  if (req.query.fromVersion != null) {
    fromVersion = parseInt(req.query.fromVersion, 10)
  } else {
    fromVersion = -1
  }

  DocumentManager.getDocAndRecentOpsWithLock(
    projectId,
    docId,
    fromVersion,
    (error, lines, version, ops, ranges, pathname) => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.log({ projectId, docId }, 'got doc via http')
      if (lines == null || version == null) {
        return next(new Errors.NotFoundError('document not found'))
      }
      res.json({
        id: docId,
        lines,
        version,
        ops,
        ranges,
        pathname,
      })
    }
  )
}

function _getTotalSizeOfLines(lines) {
  let size = 0
  for (const line of lines) {
    size += line.length + 1
  }
  return size
}

function getProjectDocsAndFlushIfOld(req, res, next) {
  const projectId = req.params.project_id
  const projectStateHash = req.query.state
  // exclude is string of existing docs "id:version,id:version,..."
  const excludeItems =
    req.query.exclude != null ? req.query.exclude.split(',') : []
  logger.log({ projectId, exclude: excludeItems }, 'getting docs via http')
  const timer = new Metrics.Timer('http.getAllDocs')
  const excludeVersions = {}
  for (const item of excludeItems) {
    const [id, version] = item.split(':')
    excludeVersions[id] = version
  }
  logger.log(
    { projectId, projectStateHash, excludeVersions },
    'excluding versions'
  )
  ProjectManager.getProjectDocsAndFlushIfOld(
    projectId,
    projectStateHash,
    excludeVersions,
    (error, result) => {
      timer.done()
      if (error instanceof Errors.ProjectStateChangedError) {
        res.sendStatus(409) // conflict
      } else if (error) {
        next(error)
      } else {
        logger.log(
          {
            projectId,
            result: result.map(doc => `${doc._id}:${doc.v}`),
          },
          'got docs via http'
        )
        res.send(result)
      }
    }
  )
}

function clearProjectState(req, res, next) {
  const projectId = req.params.project_id
  const timer = new Metrics.Timer('http.clearProjectState')
  logger.log({ projectId }, 'clearing project state via http')
  ProjectManager.clearProjectState(projectId, error => {
    timer.done()
    if (error) {
      next(error)
    } else {
      res.sendStatus(200)
    }
  })
}

function setDoc(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const { lines, source, user_id: userId, undoing } = req.body
  const lineSize = _getTotalSizeOfLines(lines)
  if (lineSize > Settings.max_doc_length) {
    logger.log(
      { projectId, docId, source, lineSize, userId },
      'document too large, returning 406 response'
    )
    return res.sendStatus(406)
  }
  logger.log(
    { projectId, docId, lines, source, userId, undoing },
    'setting doc via http'
  )
  const timer = new Metrics.Timer('http.setDoc')
  DocumentManager.setDocWithLock(
    projectId,
    docId,
    lines,
    source,
    userId,
    undoing,
    error => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.log({ projectId, docId }, 'set doc via http')
      res.sendStatus(204) // No Content
    }
  )
}

function flushDocIfLoaded(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  logger.log({ projectId, docId }, 'flushing doc via http')
  const timer = new Metrics.Timer('http.flushDoc')
  DocumentManager.flushDocIfLoadedWithLock(projectId, docId, error => {
    timer.done()
    if (error) {
      return next(error)
    }
    logger.log({ projectId, docId }, 'flushed doc via http')
    res.sendStatus(204) // No Content
  })
}

function deleteDoc(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const ignoreFlushErrors = req.query.ignore_flush_errors === 'true'
  const timer = new Metrics.Timer('http.deleteDoc')
  logger.log({ projectId, docId }, 'deleting doc via http')
  DocumentManager.flushAndDeleteDocWithLock(
    projectId,
    docId,
    { ignoreFlushErrors },
    error => {
      timer.done()
      // There is no harm in flushing project history if the previous call
      // failed and sometimes it is required
      HistoryManager.flushProjectChangesAsync(projectId)

      if (error) {
        return next(error)
      }
      logger.log({ projectId, docId }, 'deleted doc via http')
      res.sendStatus(204) // No Content
    }
  )
}

function flushProject(req, res, next) {
  const projectId = req.params.project_id
  logger.log({ projectId }, 'flushing project via http')
  const timer = new Metrics.Timer('http.flushProject')
  ProjectManager.flushProjectWithLocks(projectId, error => {
    timer.done()
    if (error) {
      return next(error)
    }
    logger.log({ projectId }, 'flushed project via http')
    res.sendStatus(204) // No Content
  })
}

function deleteProject(req, res, next) {
  const projectId = req.params.project_id
  logger.log({ projectId }, 'deleting project via http')
  const options = {}
  if (req.query.background) {
    options.background = true
  } // allow non-urgent flushes to be queued
  if (req.query.shutdown) {
    options.skip_history_flush = true
  } // don't flush history when realtime shuts down
  if (req.query.background) {
    ProjectManager.queueFlushAndDeleteProject(projectId, error => {
      if (error) {
        return next(error)
      }
      logger.log({ projectId }, 'queue delete of project via http')
      res.sendStatus(204)
    }) // No Content
  } else {
    const timer = new Metrics.Timer('http.deleteProject')
    ProjectManager.flushAndDeleteProjectWithLocks(projectId, options, error => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.log({ projectId }, 'deleted project via http')
      res.sendStatus(204) // No Content
    })
  }
}

function deleteMultipleProjects(req, res, next) {
  const projectIds = req.body.project_ids || []
  logger.log({ projectIds }, 'deleting multiple projects via http')
  async.eachSeries(
    projectIds,
    (projectId, cb) => {
      logger.log({ projectId }, 'queue delete of project via http')
      ProjectManager.queueFlushAndDeleteProject(projectId, cb)
    },
    error => {
      if (error) {
        return next(error)
      }
      res.sendStatus(204) // No Content
    }
  )
}

function acceptChanges(req, res, next) {
  const { project_id: projectId, doc_id: docId } = req.params
  let changeIds = req.body.change_ids
  if (changeIds == null) {
    changeIds = [req.params.change_id]
  }
  logger.log(
    { projectId, docId },
    `accepting ${changeIds.length} changes via http`
  )
  const timer = new Metrics.Timer('http.acceptChanges')
  DocumentManager.acceptChangesWithLock(projectId, docId, changeIds, error => {
    timer.done()
    if (error) {
      return next(error)
    }
    logger.log(
      { projectId, docId },
      `accepted ${changeIds.length} changes via http`
    )
    res.sendStatus(204) // No Content
  })
}

function deleteComment(req, res, next) {
  const {
    project_id: projectId,
    doc_id: docId,
    comment_id: commentId,
  } = req.params
  logger.log({ projectId, docId, commentId }, 'deleting comment via http')
  const timer = new Metrics.Timer('http.deleteComment')
  DocumentManager.deleteCommentWithLock(projectId, docId, commentId, error => {
    timer.done()
    if (error) {
      return next(error)
    }
    logger.log({ projectId, docId, commentId }, 'deleted comment via http')
    res.sendStatus(204) // No Content
  })
}

function updateProject(req, res, next) {
  const timer = new Metrics.Timer('http.updateProject')
  const projectId = req.params.project_id
  const { projectHistoryId, userId, updates = [], version } = req.body
  logger.log({ projectId, updates, version }, 'updating project via http')
  ProjectManager.updateProjectWithLocks(
    projectId,
    projectHistoryId,
    userId,
    updates,
    version,
    error => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.log({ projectId }, 'updated project via http')
      res.sendStatus(204) // No Content
    }
  )
}

function resyncProjectHistory(req, res, next) {
  const projectId = req.params.project_id
  const { projectHistoryId, docs, files } = req.body

  logger.log(
    { projectId, docs, files },
    'queuing project history resync via http'
  )
  HistoryManager.resyncProjectHistory(
    projectId,
    projectHistoryId,
    docs,
    files,
    error => {
      if (error) {
        return next(error)
      }
      logger.log({ projectId }, 'queued project history resync via http')
      res.sendStatus(204)
    }
  )
}

function flushAllProjects(req, res, next) {
  res.setTimeout(5 * 60 * 1000)
  const options = {
    limit: req.query.limit || 1000,
    concurrency: req.query.concurrency || 5,
    dryRun: req.query.dryRun || false,
  }
  ProjectFlusher.flushAllProjects(options, (err, projectIds) => {
    if (err) {
      logger.err({ err }, 'error bulk flushing projects')
      res.sendStatus(500)
    } else {
      res.send(projectIds)
    }
  })
}

function flushQueuedProjects(req, res, next) {
  res.setTimeout(10 * 60 * 1000)
  const options = {
    limit: req.query.limit || 1000,
    timeout: 5 * 60 * 1000,
    min_delete_age: req.query.min_delete_age || 5 * 60 * 1000,
  }
  DeleteQueueManager.flushAndDeleteOldProjects(options, (err, flushed) => {
    if (err) {
      logger.err({ err }, 'error flushing old projects')
      res.sendStatus(500)
    } else {
      logger.log({ flushed }, 'flush of queued projects completed')
      res.send({ flushed })
    }
  })
}
