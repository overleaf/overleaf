const DocumentManager = require('./DocumentManager')
const HistoryManager = require('./HistoryManager')
const ProjectManager = require('./ProjectManager')
const RedisManager = require('./RedisManager')
const Errors = require('./Errors')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const Metrics = require('./Metrics')
const DeleteQueueManager = require('./DeleteQueueManager')
const { getTotalSizeOfLines } = require('./Limits')
const async = require('async')

function getDoc(req, res, next) {
  let fromVersion
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  logger.debug({ projectId, docId }, 'getting doc via http')
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
      logger.debug({ projectId, docId }, 'got doc via http')
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
        ttlInS: RedisManager.DOC_OPS_TTL,
      })
    }
  )
}

function getComment(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const commentId = req.params.comment_id

  logger.debug({ projectId, docId, commentId }, 'getting comment via http')

  DocumentManager.getCommentWithLock(
    projectId,
    docId,
    commentId,
    (error, comment) => {
      if (error) {
        return next(error)
      }
      if (comment == null) {
        return next(new Errors.NotFoundError('comment not found'))
      }
      res.json(comment)
    }
  )
}

// return the doc from redis if present, but don't load it from mongo
function peekDoc(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  logger.debug({ projectId, docId }, 'peeking at doc via http')
  RedisManager.getDoc(projectId, docId, function (error, lines, version) {
    if (error) {
      return next(error)
    }
    if (lines == null || version == null) {
      return next(new Errors.NotFoundError('document not found'))
    }
    res.json({ id: docId, lines, version })
  })
}

function getProjectDocsAndFlushIfOld(req, res, next) {
  const projectId = req.params.project_id
  const projectStateHash = req.query.state
  // exclude is string of existing docs "id:version,id:version,..."
  const excludeItems =
    req.query.exclude != null ? req.query.exclude.split(',') : []
  logger.debug({ projectId, exclude: excludeItems }, 'getting docs via http')
  const timer = new Metrics.Timer('http.getAllDocs')
  const excludeVersions = {}
  for (const item of excludeItems) {
    const [id, version] = item.split(':')
    excludeVersions[id] = version
  }
  logger.debug(
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
        logger.debug(
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
  logger.debug({ projectId }, 'clearing project state via http')
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
  const lineSize = getTotalSizeOfLines(lines)
  if (lineSize > Settings.max_doc_length) {
    logger.warn(
      { projectId, docId, source, lineSize, userId },
      'document too large, returning 406 response'
    )
    return res.sendStatus(406)
  }
  logger.debug(
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
    true,
    (error, result) => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.debug({ projectId, docId }, 'set doc via http')
      res.json(result)
    }
  )
}

function appendToDoc(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const { lines, source, user_id: userId } = req.body
  const timer = new Metrics.Timer('http.appendToDoc')
  DocumentManager.appendToDocWithLock(
    projectId,
    docId,
    lines,
    source,
    userId,
    (error, result) => {
      timer.done()
      if (error instanceof Errors.FileTooLargeError) {
        logger.warn('refusing to append to file, it would become too large')
        return res.sendStatus(422)
      }
      if (error) {
        return next(error)
      }
      logger.debug(
        { projectId, docId, lines, source, userId },
        'appending to doc via http'
      )
      res.json(result)
    }
  )
}

function flushDocIfLoaded(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  logger.debug({ projectId, docId }, 'flushing doc via http')
  const timer = new Metrics.Timer('http.flushDoc')
  DocumentManager.flushDocIfLoadedWithLock(projectId, docId, error => {
    timer.done()
    if (error) {
      return next(error)
    }
    logger.debug({ projectId, docId }, 'flushed doc via http')
    res.sendStatus(204) // No Content
  })
}

function deleteDoc(req, res, next) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const ignoreFlushErrors = req.query.ignore_flush_errors === 'true'
  const timer = new Metrics.Timer('http.deleteDoc')
  logger.debug({ projectId, docId }, 'deleting doc via http')
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
      logger.debug({ projectId, docId }, 'deleted doc via http')
      res.sendStatus(204) // No Content
    }
  )
}

function flushProject(req, res, next) {
  const projectId = req.params.project_id
  logger.debug({ projectId }, 'flushing project via http')
  const timer = new Metrics.Timer('http.flushProject')
  ProjectManager.flushProjectWithLocks(projectId, error => {
    timer.done()
    if (error) {
      return next(error)
    }
    logger.debug({ projectId }, 'flushed project via http')
    res.sendStatus(204) // No Content
  })
}

function deleteProject(req, res, next) {
  const projectId = req.params.project_id
  logger.debug({ projectId }, 'deleting project via http')
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
      logger.debug({ projectId }, 'queue delete of project via http')
      res.sendStatus(204)
    }) // No Content
  } else {
    const timer = new Metrics.Timer('http.deleteProject')
    ProjectManager.flushAndDeleteProjectWithLocks(projectId, options, error => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.debug({ projectId }, 'deleted project via http')
      res.sendStatus(204) // No Content
    })
  }
}

function deleteMultipleProjects(req, res, next) {
  const projectIds = req.body.project_ids || []
  logger.debug({ projectIds }, 'deleting multiple projects via http')
  async.eachSeries(
    projectIds,
    (projectId, cb) => {
      logger.debug({ projectId }, 'queue delete of project via http')
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
  logger.debug(
    { projectId, docId },
    `accepting ${changeIds.length} changes via http`
  )
  const timer = new Metrics.Timer('http.acceptChanges')
  DocumentManager.acceptChangesWithLock(projectId, docId, changeIds, error => {
    timer.done()
    if (error) {
      return next(error)
    }
    logger.debug(
      { projectId, docId },
      `accepted ${changeIds.length} changes via http`
    )
    res.sendStatus(204) // No Content
  })
}

function resolveComment(req, res, next) {
  const {
    project_id: projectId,
    doc_id: docId,
    comment_id: commentId,
  } = req.params
  const userId = req.body.user_id
  logger.debug({ projectId, docId, commentId }, 'resolving comment via http')
  DocumentManager.updateCommentStateWithLock(
    projectId,
    docId,
    commentId,
    userId,
    true,
    error => {
      if (error) {
        return next(error)
      }
      logger.debug({ projectId, docId, commentId }, 'resolved comment via http')
      res.sendStatus(204) // No Content
    }
  )
}

function reopenComment(req, res, next) {
  const {
    project_id: projectId,
    doc_id: docId,
    comment_id: commentId,
  } = req.params
  const userId = req.body.user_id
  logger.debug({ projectId, docId, commentId }, 'reopening comment via http')
  DocumentManager.updateCommentStateWithLock(
    projectId,
    docId,
    commentId,
    userId,
    false,
    error => {
      if (error) {
        return next(error)
      }
      logger.debug({ projectId, docId, commentId }, 'reopened comment via http')
      res.sendStatus(204) // No Content
    }
  )
}

function deleteComment(req, res, next) {
  const {
    project_id: projectId,
    doc_id: docId,
    comment_id: commentId,
  } = req.params
  const userId = req.body.user_id
  logger.debug({ projectId, docId, commentId }, 'deleting comment via http')
  const timer = new Metrics.Timer('http.deleteComment')
  DocumentManager.deleteCommentWithLock(
    projectId,
    docId,
    commentId,
    userId,
    error => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.debug({ projectId, docId, commentId }, 'deleted comment via http')
      res.sendStatus(204) // No Content
    }
  )
}

function updateProject(req, res, next) {
  const timer = new Metrics.Timer('http.updateProject')
  const projectId = req.params.project_id
  const { projectHistoryId, userId, updates = [], version, source } = req.body
  logger.debug({ projectId, updates, version }, 'updating project via http')
  ProjectManager.updateProjectWithLocks(
    projectId,
    projectHistoryId,
    userId,
    updates,
    version,
    source,
    error => {
      timer.done()
      if (error) {
        return next(error)
      }
      logger.debug({ projectId }, 'updated project via http')
      res.sendStatus(204) // No Content
    }
  )
}

function resyncProjectHistory(req, res, next) {
  const projectId = req.params.project_id
  const {
    projectHistoryId,
    docs,
    files,
    historyRangesMigration,
    resyncProjectStructureOnly,
  } = req.body

  logger.debug(
    { projectId, docs, files },
    'queuing project history resync via http'
  )

  const opts = {}
  if (historyRangesMigration) {
    opts.historyRangesMigration = historyRangesMigration
  }
  if (resyncProjectStructureOnly) {
    opts.resyncProjectStructureOnly = resyncProjectStructureOnly
  }

  HistoryManager.resyncProjectHistory(
    projectId,
    projectHistoryId,
    docs,
    files,
    opts,
    error => {
      if (error) {
        return next(error)
      }
      logger.debug({ projectId }, 'queued project history resync via http')
      res.sendStatus(204)
    }
  )
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
      logger.info({ flushed }, 'flush of queued projects completed')
      res.send({ flushed })
    }
  })
}

/**
 * Block a project from getting loaded in docupdater
 *
 * The project is blocked only if it's not already loaded in docupdater. The
 * response indicates whether the project has been blocked or not.
 */
function blockProject(req, res, next) {
  const projectId = req.params.project_id
  RedisManager.blockProject(projectId, (err, blocked) => {
    if (err) {
      return next(err)
    }
    res.json({ blocked })
  })
}

/**
 * Unblock a project
 */
function unblockProject(req, res, next) {
  const projectId = req.params.project_id
  RedisManager.unblockProject(projectId, (err, wasBlocked) => {
    if (err) {
      return next(err)
    }
    res.json({ wasBlocked })
  })
}

module.exports = {
  getDoc,
  peekDoc,
  getProjectDocsAndFlushIfOld,
  clearProjectState,
  appendToDoc,
  setDoc,
  flushDocIfLoaded,
  deleteDoc,
  flushProject,
  deleteProject,
  deleteMultipleProjects,
  acceptChanges,
  resolveComment,
  reopenComment,
  deleteComment,
  updateProject,
  resyncProjectHistory,
  flushQueuedProjects,
  blockProject,
  unblockProject,
  getComment,
}
