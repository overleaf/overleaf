/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocumentManager
const RedisManager = require('./RedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const PersistenceManager = require('./PersistenceManager')
const DiffCodec = require('./DiffCodec')
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const HistoryManager = require('./HistoryManager')
const RealTimeRedisManager = require('./RealTimeRedisManager')
const Errors = require('./Errors')
const RangesManager = require('./RangesManager')
const async = require('async')

const MAX_UNFLUSHED_AGE = 300 * 1000 // 5 mins, document should be flushed to mongo this time after a change

module.exports = DocumentManager = {
  getDoc(project_id, doc_id, _callback) {
    if (_callback == null) {
      _callback = function (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        alreadyLoaded
      ) {}
    }
    const timer = new Metrics.Timer('docManager.getDoc')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    return RedisManager.getDoc(
      project_id,
      doc_id,
      function (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime
      ) {
        if (error != null) {
          return callback(error)
        }
        if (lines == null || version == null) {
          logger.log(
            { project_id, doc_id },
            'doc not in redis so getting from persistence API'
          )
          return PersistenceManager.getDoc(
            project_id,
            doc_id,
            function (
              error,
              lines,
              version,
              ranges,
              pathname,
              projectHistoryId,
              projectHistoryType
            ) {
              if (error != null) {
                return callback(error)
              }
              logger.log(
                {
                  project_id,
                  doc_id,
                  lines,
                  version,
                  pathname,
                  projectHistoryId,
                  projectHistoryType,
                },
                'got doc from persistence API'
              )
              return RedisManager.putDocInMemory(
                project_id,
                doc_id,
                lines,
                version,
                ranges,
                pathname,
                projectHistoryId,
                function (error) {
                  if (error != null) {
                    return callback(error)
                  }
                  return RedisManager.setHistoryType(
                    doc_id,
                    projectHistoryType,
                    function (error) {
                      if (error != null) {
                        return callback(error)
                      }
                      return callback(
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
          return callback(
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

  getDocAndRecentOps(project_id, doc_id, fromVersion, _callback) {
    if (_callback == null) {
      _callback = function (
        error,
        lines,
        version,
        ops,
        ranges,
        pathname,
        projectHistoryId
      ) {}
    }
    const timer = new Metrics.Timer('docManager.getDocAndRecentOps')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    return DocumentManager.getDoc(
      project_id,
      doc_id,
      function (error, lines, version, ranges, pathname, projectHistoryId) {
        if (error != null) {
          return callback(error)
        }
        if (fromVersion === -1) {
          return callback(
            null,
            lines,
            version,
            [],
            ranges,
            pathname,
            projectHistoryId
          )
        } else {
          return RedisManager.getPreviousDocOps(
            doc_id,
            fromVersion,
            version,
            function (error, ops) {
              if (error != null) {
                return callback(error)
              }
              return callback(
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

  setDoc(project_id, doc_id, newLines, source, user_id, undoing, _callback) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const timer = new Metrics.Timer('docManager.setDoc')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    if (newLines == null) {
      return callback(new Error('No lines were provided to setDoc'))
    }

    const UpdateManager = require('./UpdateManager')
    return DocumentManager.getDoc(
      project_id,
      doc_id,
      function (
        error,
        oldLines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        alreadyLoaded
      ) {
        if (error != null) {
          return callback(error)
        }

        if (
          oldLines != null &&
          oldLines.length > 0 &&
          oldLines[0].text != null
        ) {
          logger.log(
            { doc_id, project_id, oldLines, newLines },
            'document is JSON so not updating'
          )
          return callback(null)
        }

        logger.log(
          { doc_id, project_id, oldLines, newLines },
          'setting a document via http'
        )
        return DiffCodec.diffAsShareJsOp(
          oldLines,
          newLines,
          function (error, op) {
            if (error != null) {
              return callback(error)
            }
            if (undoing) {
              for (const o of Array.from(op || [])) {
                o.u = true
              } // Turn on undo flag for each op for track changes
            }
            const update = {
              doc: doc_id,
              op,
              v: version,
              meta: {
                type: 'external',
                source,
                user_id,
              },
            }
            return UpdateManager.applyUpdate(
              project_id,
              doc_id,
              update,
              function (error) {
                if (error != null) {
                  return callback(error)
                }
                // If the document was loaded already, then someone has it open
                // in a project, and the usual flushing mechanism will happen.
                // Otherwise we should remove it immediately since nothing else
                // is using it.
                if (alreadyLoaded) {
                  return DocumentManager.flushDocIfLoaded(
                    project_id,
                    doc_id,
                    function (error) {
                      if (error != null) {
                        return callback(error)
                      }
                      return callback(null)
                    }
                  )
                } else {
                  return DocumentManager.flushAndDeleteDoc(
                    project_id,
                    doc_id,
                    {},
                    function (error) {
                      // There is no harm in flushing project history if the previous
                      // call failed and sometimes it is required
                      HistoryManager.flushProjectChangesAsync(project_id)

                      if (error != null) {
                        return callback(error)
                      }
                      return callback(null)
                    }
                  )
                }
              }
            )
          }
        )
      }
    )
  },

  flushDocIfLoaded(project_id, doc_id, _callback) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const timer = new Metrics.Timer('docManager.flushDocIfLoaded')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }
    return RedisManager.getDoc(
      project_id,
      doc_id,
      function (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        lastUpdatedAt,
        lastUpdatedBy
      ) {
        if (error != null) {
          return callback(error)
        }
        if (lines == null || version == null) {
          logger.log(
            { project_id, doc_id },
            'doc is not loaded so not flushing'
          )
          return callback(null) // TODO: return a flag to bail out, as we go on to remove doc from memory?
        } else {
          logger.log({ project_id, doc_id, version }, 'flushing doc')
          return PersistenceManager.setDoc(
            project_id,
            doc_id,
            lines,
            version,
            ranges,
            lastUpdatedAt,
            lastUpdatedBy,
            function (error) {
              if (error != null) {
                return callback(error)
              }
              return RedisManager.clearUnflushedTime(doc_id, callback)
            }
          )
        }
      }
    )
  },

  flushAndDeleteDoc(project_id, doc_id, options, _callback) {
    const timer = new Metrics.Timer('docManager.flushAndDeleteDoc')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    return DocumentManager.flushDocIfLoaded(
      project_id,
      doc_id,
      function (error) {
        if (error != null) {
          if (options.ignoreFlushErrors) {
            logger.warn(
              { project_id, doc_id, err: error },
              'ignoring flush error while deleting document'
            )
          } else {
            return callback(error)
          }
        }

        // Flush in the background since it requires a http request
        HistoryManager.flushDocChangesAsync(project_id, doc_id)

        return RedisManager.removeDocFromMemory(
          project_id,
          doc_id,
          function (error) {
            if (error != null) {
              return callback(error)
            }
            return callback(null)
          }
        )
      }
    )
  },

  acceptChanges(project_id, doc_id, change_ids, _callback) {
    if (change_ids == null) {
      change_ids = []
    }
    if (_callback == null) {
      _callback = function (error) {}
    }
    const timer = new Metrics.Timer('docManager.acceptChanges')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    return DocumentManager.getDoc(
      project_id,
      doc_id,
      function (error, lines, version, ranges) {
        if (error != null) {
          return callback(error)
        }
        if (lines == null || version == null) {
          return callback(
            new Errors.NotFoundError(`document not found: ${doc_id}`)
          )
        }
        return RangesManager.acceptChanges(
          change_ids,
          ranges,
          function (error, new_ranges) {
            if (error != null) {
              return callback(error)
            }
            return RedisManager.updateDocument(
              project_id,
              doc_id,
              lines,
              version,
              [],
              new_ranges,
              {},
              function (error) {
                if (error != null) {
                  return callback(error)
                }
                return callback()
              }
            )
          }
        )
      }
    )
  },

  deleteComment(project_id, doc_id, comment_id, _callback) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const timer = new Metrics.Timer('docManager.deleteComment')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    return DocumentManager.getDoc(
      project_id,
      doc_id,
      function (error, lines, version, ranges) {
        if (error != null) {
          return callback(error)
        }
        if (lines == null || version == null) {
          return callback(
            new Errors.NotFoundError(`document not found: ${doc_id}`)
          )
        }
        return RangesManager.deleteComment(
          comment_id,
          ranges,
          function (error, new_ranges) {
            if (error != null) {
              return callback(error)
            }
            return RedisManager.updateDocument(
              project_id,
              doc_id,
              lines,
              version,
              [],
              new_ranges,
              {},
              function (error) {
                if (error != null) {
                  return callback(error)
                }
                return callback()
              }
            )
          }
        )
      }
    )
  },

  renameDoc(project_id, doc_id, user_id, update, projectHistoryId, _callback) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const timer = new Metrics.Timer('docManager.updateProject')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    return RedisManager.renameDoc(
      project_id,
      doc_id,
      user_id,
      update,
      projectHistoryId,
      callback
    )
  },

  getDocAndFlushIfOld(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error, doc) {}
    }
    return DocumentManager.getDoc(
      project_id,
      doc_id,
      function (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        alreadyLoaded
      ) {
        if (error != null) {
          return callback(error)
        }
        // if doc was already loaded see if it needs to be flushed
        if (
          alreadyLoaded &&
          unflushedTime != null &&
          Date.now() - unflushedTime > MAX_UNFLUSHED_AGE
        ) {
          return DocumentManager.flushDocIfLoaded(
            project_id,
            doc_id,
            function (error) {
              if (error != null) {
                return callback(error)
              }
              return callback(null, lines, version)
            }
          )
        } else {
          return callback(null, lines, version)
        }
      }
    )
  },

  resyncDocContents(project_id, doc_id, callback) {
    logger.log({ project_id, doc_id }, 'start resyncing doc contents')
    return RedisManager.getDoc(
      project_id,
      doc_id,
      function (error, lines, version, ranges, pathname, projectHistoryId) {
        if (error != null) {
          return callback(error)
        }

        if (lines == null || version == null) {
          logger.log(
            { project_id, doc_id },
            'resyncing doc contents - not found in redis - retrieving from web'
          )
          return PersistenceManager.getDoc(
            project_id,
            doc_id,
            function (
              error,
              lines,
              version,
              ranges,
              pathname,
              projectHistoryId
            ) {
              if (error != null) {
                logger.error(
                  { project_id, doc_id, getDocError: error },
                  'resyncing doc contents - error retrieving from web'
                )
                return callback(error)
              }
              return ProjectHistoryRedisManager.queueResyncDocContent(
                project_id,
                projectHistoryId,
                doc_id,
                lines,
                version,
                pathname,
                callback
              )
            }
          )
        } else {
          logger.log(
            { project_id, doc_id },
            'resyncing doc contents - doc in redis - will queue in redis'
          )
          return ProjectHistoryRedisManager.queueResyncDocContent(
            project_id,
            projectHistoryId,
            doc_id,
            lines,
            version,
            pathname,
            callback
          )
        }
      }
    )
  },

  getDocWithLock(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error, lines, version) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.getDoc,
      project_id,
      doc_id,
      callback
    )
  },

  getDocAndRecentOpsWithLock(project_id, doc_id, fromVersion, callback) {
    if (callback == null) {
      callback = function (
        error,
        lines,
        version,
        ops,
        ranges,
        pathname,
        projectHistoryId
      ) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.getDocAndRecentOps,
      project_id,
      doc_id,
      fromVersion,
      callback
    )
  },

  getDocAndFlushIfOldWithLock(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error, doc) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.getDocAndFlushIfOld,
      project_id,
      doc_id,
      callback
    )
  },

  setDocWithLock(
    project_id,
    doc_id,
    lines,
    source,
    user_id,
    undoing,
    callback
  ) {
    if (callback == null) {
      callback = function (error) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.setDoc,
      project_id,
      doc_id,
      lines,
      source,
      user_id,
      undoing,
      callback
    )
  },

  flushDocIfLoadedWithLock(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.flushDocIfLoaded,
      project_id,
      doc_id,
      callback
    )
  },

  flushAndDeleteDocWithLock(project_id, doc_id, options, callback) {
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.flushAndDeleteDoc,
      project_id,
      doc_id,
      options,
      callback
    )
  },

  acceptChangesWithLock(project_id, doc_id, change_ids, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.acceptChanges,
      project_id,
      doc_id,
      change_ids,
      callback
    )
  },

  deleteCommentWithLock(project_id, doc_id, thread_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.deleteComment,
      project_id,
      doc_id,
      thread_id,
      callback
    )
  },

  renameDocWithLock(
    project_id,
    doc_id,
    user_id,
    update,
    projectHistoryId,
    callback
  ) {
    if (callback == null) {
      callback = function (error) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.renameDoc,
      project_id,
      doc_id,
      user_id,
      update,
      projectHistoryId,
      callback
    )
  },

  resyncDocContentsWithLock(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const UpdateManager = require('./UpdateManager')
    return UpdateManager.lockUpdatesAndDo(
      DocumentManager.resyncDocContents,
      project_id,
      doc_id,
      callback
    )
  },
}
