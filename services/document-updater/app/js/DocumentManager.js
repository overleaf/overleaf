let DocumentManager
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

module.exports = DocumentManager = {
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
        unflushedTime
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
              projectHistoryType
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
                  projectHistoryType,
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
                error => {
                  if (error) {
                    return callback(error)
                  }
                  RedisManager.setHistoryType(
                    docId,
                    projectHistoryType,
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
                        false
                      )
                    }
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
            true
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
          UpdateManager.applyUpdate(projectId, docId, update, error => {
            if (error) {
              return callback(error)
            }
            // If the document was loaded already, then someone has it open
            // in a project, and the usual flushing mechanism will happen.
            // Otherwise we should remove it immediately since nothing else
            // is using it.
            if (alreadyLoaded) {
              DocumentManager.flushDocIfLoaded(projectId, docId, error => {
                if (error) {
                  return callback(error)
                }
                callback(null)
              })
            } else {
              DocumentManager.flushAndDeleteDoc(projectId, docId, {}, error => {
                // There is no harm in flushing project history if the previous
                // call failed and sometimes it is required
                HistoryManager.flushProjectChangesAsync(projectId)

                if (error) {
                  return callback(error)
                }
                callback(null)
              })
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
          logger.debug(
            { projectId, docId },
            'doc is not loaded so not flushing'
          )
          // TODO: return a flag to bail out, as we go on to remove doc from memory?
          callback(null)
        } else {
          logger.debug({ projectId, docId, version }, 'flushing doc')
          PersistenceManager.setDoc(
            projectId,
            docId,
            lines,
            version,
            ranges,
            lastUpdatedAt,
            lastUpdatedBy,
            error => {
              if (error) {
                return callback(error)
              }
              RedisManager.clearUnflushedTime(docId, callback)
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

    DocumentManager.flushDocIfLoaded(projectId, docId, error => {
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

      // Flush in the background since it requires a http request
      HistoryManager.flushDocChangesAsync(projectId, docId)

      RedisManager.removeDocFromMemory(projectId, docId, error => {
        if (error) {
          return callback(error)
        }
        callback(null)
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
        RangesManager.acceptChanges(changeIds, ranges, (error, newRanges) => {
          if (error) {
            return callback(error)
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
        })
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
        RangesManager.deleteComment(commentId, ranges, (error, newRanges) => {
          if (error) {
            return callback(error)
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
        })
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
