/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HttpController
const DocumentManager = require('./DocumentManager')
const HistoryManager = require('./HistoryManager')
const ProjectManager = require('./ProjectManager')
const Errors = require('./Errors')
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const ProjectFlusher = require('./ProjectFlusher')
const DeleteQueueManager = require('./DeleteQueueManager')
const async = require('async')

const TWO_MEGABYTES = 2 * 1024 * 1024

module.exports = HttpController = {
  getDoc(req, res, next) {
    let fromVersion
    if (next == null) {
      next = function (error) {}
    }
    const { doc_id } = req.params
    const { project_id } = req.params
    logger.log({ project_id, doc_id }, 'getting doc via http')
    const timer = new Metrics.Timer('http.getDoc')

    if ((req.query != null ? req.query.fromVersion : undefined) != null) {
      fromVersion = parseInt(req.query.fromVersion, 10)
    } else {
      fromVersion = -1
    }

    return DocumentManager.getDocAndRecentOpsWithLock(
      project_id,
      doc_id,
      fromVersion,
      function (error, lines, version, ops, ranges, pathname) {
        timer.done()
        if (error != null) {
          return next(error)
        }
        logger.log({ project_id, doc_id }, 'got doc via http')
        if (lines == null || version == null) {
          return next(new Errors.NotFoundError('document not found'))
        }
        return res.json({
          id: doc_id,
          lines,
          version,
          ops,
          ranges,
          pathname
        })
      }
    )
  },

  _getTotalSizeOfLines(lines) {
    let size = 0
    for (const line of lines) {
      size += line.length + 1
    }
    return size
  },

  getProjectDocsAndFlushIfOld(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    const projectStateHash = req.query != null ? req.query.state : undefined
    // exclude is string of existing docs "id:version,id:version,..."
    const excludeItems =
      __guard__(req.query != null ? req.query.exclude : undefined, (x) =>
        x.split(',')
      ) || []
    logger.log({ project_id, exclude: excludeItems }, 'getting docs via http')
    const timer = new Metrics.Timer('http.getAllDocs')
    const excludeVersions = {}
    for (const item of excludeItems) {
      const [id, version] = item.split(':')
      excludeVersions[id] = version
    }
    logger.log(
      { project_id, projectStateHash, excludeVersions },
      'excluding versions'
    )
    return ProjectManager.getProjectDocsAndFlushIfOld(
      project_id,
      projectStateHash,
      excludeVersions,
      function (error, result) {
        timer.done()
        if (error instanceof Errors.ProjectStateChangedError) {
          return res.sendStatus(409) // conflict
        } else if (error != null) {
          return next(error)
        } else {
          logger.log(
            {
              project_id,
              result: result.map((doc) => `${doc._id}:${doc.v}`)
            },
            'got docs via http'
          )
          return res.send(result)
        }
      }
    )
  },

  clearProjectState(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    const timer = new Metrics.Timer('http.clearProjectState')
    logger.log({ project_id }, 'clearing project state via http')
    return ProjectManager.clearProjectState(project_id, function (error) {
      timer.done()
      if (error != null) {
        return next(error)
      } else {
        return res.sendStatus(200)
      }
    })
  },

  setDoc(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { doc_id } = req.params
    const { project_id } = req.params
    const { lines, source, user_id, undoing } = req.body
    const lineSize = HttpController._getTotalSizeOfLines(lines)
    if (lineSize > TWO_MEGABYTES) {
      logger.log(
        { project_id, doc_id, source, lineSize, user_id },
        'document too large, returning 406 response'
      )
      return res.sendStatus(406)
    }
    logger.log(
      { project_id, doc_id, lines, source, user_id, undoing },
      'setting doc via http'
    )
    const timer = new Metrics.Timer('http.setDoc')
    return DocumentManager.setDocWithLock(
      project_id,
      doc_id,
      lines,
      source,
      user_id,
      undoing,
      function (error) {
        timer.done()
        if (error != null) {
          return next(error)
        }
        logger.log({ project_id, doc_id }, 'set doc via http')
        return res.sendStatus(204)
      }
    )
  }, // No Content

  flushDocIfLoaded(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { doc_id } = req.params
    const { project_id } = req.params
    logger.log({ project_id, doc_id }, 'flushing doc via http')
    const timer = new Metrics.Timer('http.flushDoc')
    return DocumentManager.flushDocIfLoadedWithLock(
      project_id,
      doc_id,
      function (error) {
        timer.done()
        if (error != null) {
          return next(error)
        }
        logger.log({ project_id, doc_id }, 'flushed doc via http')
        return res.sendStatus(204)
      }
    )
  }, // No Content

  deleteDoc(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { doc_id } = req.params
    const { project_id } = req.params
    const ignoreFlushErrors = req.query.ignore_flush_errors === 'true'
    const timer = new Metrics.Timer('http.deleteDoc')
    logger.log({ project_id, doc_id }, 'deleting doc via http')
    return DocumentManager.flushAndDeleteDocWithLock(
      project_id,
      doc_id,
      { ignoreFlushErrors },
      function (error) {
        timer.done()
        // There is no harm in flushing project history if the previous call
        // failed and sometimes it is required
        HistoryManager.flushProjectChangesAsync(project_id)

        if (error != null) {
          return next(error)
        }
        logger.log({ project_id, doc_id }, 'deleted doc via http')
        return res.sendStatus(204)
      }
    )
  }, // No Content

  flushProject(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    logger.log({ project_id }, 'flushing project via http')
    const timer = new Metrics.Timer('http.flushProject')
    return ProjectManager.flushProjectWithLocks(project_id, function (error) {
      timer.done()
      if (error != null) {
        return next(error)
      }
      logger.log({ project_id }, 'flushed project via http')
      return res.sendStatus(204)
    })
  }, // No Content

  deleteProject(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    logger.log({ project_id }, 'deleting project via http')
    const options = {}
    if (req.query != null ? req.query.background : undefined) {
      options.background = true
    } // allow non-urgent flushes to be queued
    if (req.query != null ? req.query.shutdown : undefined) {
      options.skip_history_flush = true
    } // don't flush history when realtime shuts down
    if (req.query != null ? req.query.background : undefined) {
      return ProjectManager.queueFlushAndDeleteProject(project_id, function (
        error
      ) {
        if (error != null) {
          return next(error)
        }
        logger.log({ project_id }, 'queue delete of project via http')
        return res.sendStatus(204)
      }) // No Content
    } else {
      const timer = new Metrics.Timer('http.deleteProject')
      return ProjectManager.flushAndDeleteProjectWithLocks(
        project_id,
        options,
        function (error) {
          timer.done()
          if (error != null) {
            return next(error)
          }
          logger.log({ project_id }, 'deleted project via http')
          return res.sendStatus(204)
        }
      )
    }
  }, // No Content

  deleteMultipleProjects(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const project_ids =
      (req.body != null ? req.body.project_ids : undefined) || []
    logger.log({ project_ids }, 'deleting multiple projects via http')
    return async.eachSeries(
      project_ids,
      function (project_id, cb) {
        logger.log({ project_id }, 'queue delete of project via http')
        return ProjectManager.queueFlushAndDeleteProject(project_id, cb)
      },
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  }, // No Content

  acceptChanges(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id, doc_id } = req.params
    let change_ids = req.body != null ? req.body.change_ids : undefined
    if (change_ids == null) {
      change_ids = [req.params.change_id]
    }
    logger.log(
      { project_id, doc_id },
      `accepting ${change_ids.length} changes via http`
    )
    const timer = new Metrics.Timer('http.acceptChanges')
    return DocumentManager.acceptChangesWithLock(
      project_id,
      doc_id,
      change_ids,
      function (error) {
        timer.done()
        if (error != null) {
          return next(error)
        }
        logger.log(
          { project_id, doc_id },
          `accepted ${change_ids.length} changes via http`
        )
        return res.sendStatus(204)
      }
    )
  }, // No Content

  deleteComment(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id, doc_id, comment_id } = req.params
    logger.log({ project_id, doc_id, comment_id }, 'deleting comment via http')
    const timer = new Metrics.Timer('http.deleteComment')
    return DocumentManager.deleteCommentWithLock(
      project_id,
      doc_id,
      comment_id,
      function (error) {
        timer.done()
        if (error != null) {
          return next(error)
        }
        logger.log(
          { project_id, doc_id, comment_id },
          'deleted comment via http'
        )
        return res.sendStatus(204)
      }
    )
  }, // No Content

  updateProject(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const timer = new Metrics.Timer('http.updateProject')
    const { project_id } = req.params
    const {
      projectHistoryId,
      userId,
      docUpdates,
      fileUpdates,
      version
    } = req.body
    logger.log(
      { project_id, docUpdates, fileUpdates, version },
      'updating project via http'
    )

    return ProjectManager.updateProjectWithLocks(
      project_id,
      projectHistoryId,
      userId,
      docUpdates,
      fileUpdates,
      version,
      function (error) {
        timer.done()
        if (error != null) {
          return next(error)
        }
        logger.log({ project_id }, 'updated project via http')
        return res.sendStatus(204)
      }
    )
  }, // No Content

  resyncProjectHistory(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    const { projectHistoryId, docs, files } = req.body

    logger.log(
      { project_id, docs, files },
      'queuing project history resync via http'
    )
    return HistoryManager.resyncProjectHistory(
      project_id,
      projectHistoryId,
      docs,
      files,
      function (error) {
        if (error != null) {
          return next(error)
        }
        logger.log({ project_id }, 'queued project history resync via http')
        return res.sendStatus(204)
      }
    )
  },

  flushAllProjects(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    res.setTimeout(5 * 60 * 1000)
    const options = {
      limit: req.query.limit || 1000,
      concurrency: req.query.concurrency || 5,
      dryRun: req.query.dryRun || false
    }
    return ProjectFlusher.flushAllProjects(options, function (
      err,
      project_ids
    ) {
      if (err != null) {
        logger.err({ err }, 'error bulk flushing projects')
        return res.sendStatus(500)
      } else {
        return res.send(project_ids)
      }
    })
  },

  flushQueuedProjects(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    res.setTimeout(10 * 60 * 1000)
    const options = {
      limit: req.query.limit || 1000,
      timeout: 5 * 60 * 1000,
      min_delete_age: req.query.min_delete_age || 5 * 60 * 1000
    }
    return DeleteQueueManager.flushAndDeleteOldProjects(options, function (
      err,
      flushed
    ) {
      if (err != null) {
        logger.err({ err }, 'error flushing old projects')
        return res.sendStatus(500)
      } else {
        logger.log({ flushed }, 'flush of queued projects completed')
        return res.send({ flushed })
      }
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
