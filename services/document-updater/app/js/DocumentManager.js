const { promisifyAll } = require('@overleaf/promise-utils')
const RedisManager = require('./RedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const PersistenceManager = require('./PersistenceManager')
const DiffCodec = require('./DiffCodec')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const HistoryManager = require('./HistoryManager')
const Errors = require('./Errors')
const RangesManager = require('./RangesManager')

const MAX_UNFLUSHED_AGE = 300 * 1000 // 5 mins, document should be flushed to mongo this time after a change

const DocumentManager = {
  getDoc(projectId, docId, _callback) {
    const timer = new Metrics.Timer('docManager.getDoc')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }

    RedisManager.getDoc(
      projectId,
      docId,
      (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        lastUpdatedAt,
        lastUpdatedBy,
        historyRangesSupport
      ) => {
        if (error) {
          return callback(error)
        }
        if (lines == null || version == null) {
          logger.debug(
            { projectId, docId },
            'doc not in redis so getting from persistence API'
          )
          PersistenceManager.getDoc(
            projectId,
            docId,
            (
              error,
              lines,
              version,
              ranges,
              pathname,
              projectHistoryId,
              historyRangesSupport
            ) => {
              if (error) {
                return callback(error)
              }
              logger.debug(
                {
                  projectId,
                  docId,
                  lines,
                  version,
                  pathname,
                  projectHistoryId,
                  historyRangesSupport,
                },
                'got doc from persistence API'
              )
              RedisManager.putDocInMemory(
                projectId,
                docId,
                lines,
                version,
                ranges,
                pathname,
                projectHistoryId,
                historyRangesSupport,
                error => {
                  if (error) {
                    return callback(error)
                  }
                  callback(
                    null,
                    lines,
                    version,
                    ranges || {},
                    pathname,
                    projectHistoryId,
                    null,
                    false,
                    historyRangesSupport
                  )
                }
              )
            }
          )
        } else {
          callback(
            null,
            lines,
            version,
            ranges,
            pathname,
            projectHistoryId,
            unflushedTime,
            true,
            historyRangesSupport
          )
        }
      }
    )
  },

  getDocAndRecentOps(projectId, docId, fromVersion, _callback) {
    const timer = new Metrics.Timer('docManager.getDocAndRecentOps')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }

    DocumentManager.getDoc(
      projectId,
      docId,
      (error, lines, version, ranges, pathname, projectHistoryId) => {
        if (error) {
          return callback(error)
        }
        if (fromVersion === -1) {
          callback(null, lines, version, [], ranges, pathname, projectHistoryId)
        } else {
          RedisManager.getPreviousDocOps(
            docId,
            fromVersion,
            version,
            (error, ops) => {
              if (error) {
                return callback(error)
              }
              callback(
                null,
                lines,
                version,
                ops,
                ranges,
                pathname,
                projectHistoryId
              )
            }
          )
        }
      }
    )
  },

  setDoc(projectId, docId, newLines, source, userId, undoing, _callback) {
    const timer = new Metrics.Timer('docManager.setDoc')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }

    if (newLines == null) {
      return callback(new Error('No lines were provided to setDoc'))
    }

    const UpdateManager = require('./UpdateManager')
    DocumentManager.getDoc(
      projectId,
      docId,
      (
        error,
        oldLines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        alreadyLoaded
      ) => {
        if (error) {
          return callback(error)
        }

        if (
          oldLines != null &&
          oldLines.length > 0 &&
          oldLines[0].text != null
        ) {
          logger.debug(
            { docId, projectId, oldLines, newLines },
            'document is JSON so not updating'
          )
          return callback(null)
        }

        logger.debug(
          { docId, projectId, oldLines, newLines },
          'setting a document via http'
        )
        DiffCodec.diffAsShareJsOp(oldLines, newLines, (error, op) => {
          if (error) {
            return callback(error)
          }
          if (undoing) {
            for (const o of op || []) {
              o.u = true
            } // Turn on undo flag for each op for track changes
          }
          const update = {
            doc: docId,
            op,
            v: version,
            meta: {
              type: 'external',
              source,
              user_id: userId,
            },
          }
          // Keep track of external updates, whether they are for live documents
          // (flush) or unloaded documents (evict), and whether the update is a no-op.
          Metrics.inc('external-update', 1, {
            status: op.length > 0 ? 'diff' : 'noop',
            method: alreadyLoaded ? 'flush' : 'evict',
            path: source,
          })
          const applyUpdateIfNeeded = cb => {
            if (op.length === 0) {
              // Do not notify the frontend about a noop update.
              // We still want to execute the callback code below
              // to evict the doc if we loaded it into redis for
              // this update, otherwise the doc would never be
              // removed from redis.
              return cb(null)
            }
            UpdateManager.applyUpdate(projectId, docId, update, cb)
          }
          applyUpdateIfNeeded(error => {
            if (error) {
              return callback(error)
            }
            // If the document was loaded already, then someone has it open
            // in a project, and the usual flushing mechanism will happen.
            // Otherwise we should remove it immediately since nothing else
            // is using it.
            if (alreadyLoaded) {
              DocumentManager.flushDocIfLoaded(
                projectId,
                docId,
                (error, result) => {
                  if (error) {
                    return callback(error)
                  }
                  callback(null, result)
                }
              )
            } else {
              DocumentManager.flushAndDeleteDoc(
                projectId,
                docId,
                {},
                (error, result) => {
                  // There is no harm in flushing project history if the previous
                  // call failed and sometimes it is required
                  HistoryManager.flushProjectChangesAsync(projectId)

                  if (error) {
                    return callback(error)
                  }
                  callback(null, result)
                }
              )
            }
          })
        })
      }
    )
  },

  flushDocIfLoaded(projectId, docId, _callback) {
    const timer = new Metrics.Timer('docManager.flushDocIfLoaded')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }
    RedisManager.getDoc(
      projectId,
      docId,
      (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        lastUpdatedAt,
        lastUpdatedBy
      ) => {
        if (error) {
          return callback(error)
        }
        if (lines == null || version == null) {
          Metrics.inc('flush-doc-if-loaded', 1, { status: 'not-loaded' })
          logger.debug(
            { projectId, docId },
            'doc is not loaded so not flushing'
          )
          // TODO: return a flag to bail out, as we go on to remove doc from memory?
          callback(null)
        } else if (unflushedTime == null) {
          Metrics.inc('flush-doc-if-loaded', 1, { status: 'unmodified' })
          logger.debug(
            { projectId, docId },
            'doc is not modified so not flushing'
          )
          callback(null)
        } else {
          logger.debug({ projectId, docId, version }, 'flushing doc')
          Metrics.inc('flush-doc-if-loaded', 1, { status: 'modified' })
          PersistenceManager.setDoc(
            projectId,
            docId,
            lines,
            version,
            ranges,
            lastUpdatedAt,
            lastUpdatedBy,
            (error, result) => {
              if (error) {
                return callback(error)
              }
              RedisManager.clearUnflushedTime(docId, err => {
                if (err) {
                  return callback(err)
                }
                callback(null, result)
              })
            }
          )
        }
      }
    )
  },

  flushAndDeleteDoc(projectId, docId, options, _callback) {
    const timer = new Metrics.Timer('docManager.flushAndDeleteDoc')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }

    DocumentManager.flushDocIfLoaded(projectId, docId, (error, result) => {
      if (error) {
        if (options.ignoreFlushErrors) {
          logger.warn(
            { projectId, docId, err: error },
            'ignoring flush error while deleting document'
          )
        } else {
          return callback(error)
        }
      }

      RedisManager.removeDocFromMemory(projectId, docId, error => {
        if (error) {
          return callback(error)
        }
        callback(null, result)
      })
    })
  },

  acceptChanges(projectId, docId, changeIds, _callback) {
    if (changeIds == null) {
      changeIds = []
    }
    const timer = new Metrics.Timer('docManager.acceptChanges')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }

    DocumentManager.getDoc(
      projectId,
      docId,
      (error, lines, version, ranges) => {
        if (error) {
          return callback(error)
        }
        if (lines == null || version == null) {
          return callback(
            new Errors.NotFoundError(`document not found: ${docId}`)
          )
        }

        let newRanges
        try {
          newRanges = RangesManager.acceptChanges(changeIds, ranges)
        } catch (err) {
          return callback(err)
        }

        RedisManager.updateDocument(
          projectId,
          docId,
          lines,
          version,
          [],
          newRanges,
          {},
          error => {
            if (error) {
              return callback(error)
            }
            callback()
          }
        )
      }
    )
  },

  deleteComment(projectId, docId, commentId, _callback) {
    const timer = new Metrics.Timer('docManager.deleteComment')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }

    DocumentManager.getDoc(
      projectId,
      docId,
      (error, lines, version, ranges) => {
        if (error) {
          return callback(error)
        }
        if (lines == null || version == null) {
          return callback(
            new Errors.NotFoundError(`document not found: ${docId}`)
          )
        }

        let newRanges
        try {
          newRanges = RangesManager.deleteComment(commentId, ranges)
        } catch (err) {
          return callback(err)
        }

        RedisManager.updateDocument(
          projectId,
          docId,
          lines,
          version,
          [],
          newRanges,
          {},
          error => {
            if (error) {
              return callback(error)
            }
            callback()
          }
        )
      }
    )
  },

  renameDoc(projectId, docId, userId, update, projectHistoryId, _callback) {
    const timer = new Metrics.Timer('docManager.updateProject')
    const callback = (...args) => {
      timer.done()
      _callback(...args)
    }

    RedisManager.renameDoc(
      projectId,
      docId,
      userId,
      update,
      projectHistoryId,
      callback
    )
  },

  getDocAndFlushIfOld(projectId, docId, callback) {
    DocumentManager.getDoc(
      projectId,
      docId,
      (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        alreadyLoaded
      ) => {
        if (error) {
          return callback(error)
        }
        // if doc was already loaded see if it needs to be flushed
        if (
          alreadyLoaded &&
          unflushedTime != null &&
          Date.now() - unflushedTime > MAX_UNFLUSHED_AGE
        ) {
          DocumentManager.flushDocIfLoaded(projectId, docId, error => {
            if (error) {
              return callback(error)
            }
            callback(null, lines, version)
          })
        } else {
          callback(null, lines, version)
        }
      }
    )
  },

  resyncDocContents(projectId, docId, path, callback) {
    logger.debug({ projectId, docId, path }, 'start resyncing doc contents')
    RedisManager.getDoc(
      projectId,
      docId,
      (error, lines, version, ranges, pathname, projectHistoryId) => {
        if (error) {
          return callback(error)
        }
        // To avoid issues where the same docId appears with different paths,
        // we use the path from the resyncProjectStructure update.  If we used
        // the path from the getDoc call to web then the two occurences of the
        // docId would map to the same path, and this would be rejected by
        // project-history as an unexpected resyncDocContent update.
        if (lines == null || version == null) {
          logger.debug(
            { projectId, docId },
            'resyncing doc contents - not found in redis - retrieving from web'
          )
          PersistenceManager.getDoc(
            projectId,
            docId,
            { peek: true },
            (error, lines, version, ranges, pathname, projectHistoryId) => {
              if (error) {
                logger.error(
                  { projectId, docId, getDocError: error },
                  'resyncing doc contents - error retrieving from web'
                )
                return callback(error)
              }
              ProjectHistoryRedisManager.queueResyncDocContent(
                projectId,
                projectHistoryId,
                docId,
                lines,
                version,
                path, // use the path from the resyncProjectStructure update
                callback
              )
            }
          )
        } else {
          logger.debug(
            { projectId, docId },
            'resyncing doc contents - doc in redis - will queue in redis'
          )
          ProjectHistoryRedisManager.queueResyncDocContent(
            projectId,
            projectHistoryId,
            docId,
            lines,
            version,
            path, // use the path from the resyncProjectStructure update
            callback
          )
        }
      }
    )
  },

  getDocWithLock(projectId, docId, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.getDoc,
      projectId,
      docId,
      callback
    )
  },

  getDocAndRecentOpsWithLock(projectId, docId, fromVersion, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.getDocAndRecentOps,
      projectId,
      docId,
      fromVersion,
      callback
    )
  },

  getDocAndFlushIfOldWithLock(projectId, docId, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.getDocAndFlushIfOld,
      projectId,
      docId,
      callback
    )
  },

  setDocWithLock(projectId, docId, lines, source, userId, undoing, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.setDoc,
      projectId,
      docId,
      lines,
      source,
      userId,
      undoing,
      callback
    )
  },

  flushDocIfLoadedWithLock(projectId, docId, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.flushDocIfLoaded,
      projectId,
      docId,
      callback
    )
  },

  flushAndDeleteDocWithLock(projectId, docId, options, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.flushAndDeleteDoc,
      projectId,
      docId,
      options,
      callback
    )
  },

  acceptChangesWithLock(projectId, docId, changeIds, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.acceptChanges,
      projectId,
      docId,
      changeIds,
      callback
    )
  },

  deleteCommentWithLock(projectId, docId, threadId, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.deleteComment,
      projectId,
      docId,
      threadId,
      callback
    )
  },

  renameDocWithLock(
    projectId,
    docId,
    userId,
    update,
    projectHistoryId,
    callback
  ) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.renameDoc,
      projectId,
      docId,
      userId,
      update,
      projectHistoryId,
      callback
    )
  },

  resyncDocContentsWithLock(projectId, docId, path, callback) {
    const UpdateManager = require('./UpdateManager')
    UpdateManager.lockUpdatesAndDo(
      DocumentManager.resyncDocContents,
      projectId,
      docId,
      path,
      callback
    )
  },
}

module.exports = DocumentManager
module.exports.promises = promisifyAll(DocumentManager, {
  multiResult: {
    getDoc: [
      'lines',
      'version',
      'ranges',
      'pathname',
      'projectHistoryId',
      'unflushedTime',
      'alreadyLoaded',
      'historyRangesSupport',
    ],
    getDocWithLock: [
      'lines',
      'version',
      'ranges',
      'pathname',
      'projectHistoryId',
      'unflushedTime',
      'alreadyLoaded',
      'historyRangesSupport',
    ],
    getDocAndFlushIfOld: ['lines', 'version'],
    getDocAndFlushIfOldWithLock: ['lines', 'version'],
    getDocAndRecentOps: [
      'lines',
      'version',
      'ops',
      'ranges',
      'pathname',
      'projectHistoryId',
    ],
    getDocAndRecentOpsWithLock: [
      'lines',
      'version',
      'ops',
      'ranges',
      'pathname',
      'projectHistoryId',
    ],
  },
})
