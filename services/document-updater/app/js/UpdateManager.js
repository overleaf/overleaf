/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UpdateManager
const LockManager = require('./LockManager')
const RedisManager = require('./RedisManager')
const RealTimeRedisManager = require('./RealTimeRedisManager')
const ShareJsUpdateManager = require('./ShareJsUpdateManager')
const HistoryManager = require('./HistoryManager')
const Settings = require('@overleaf/settings')
const _ = require('lodash')
const async = require('async')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const Errors = require('./Errors')
const DocumentManager = require('./DocumentManager')
const RangesManager = require('./RangesManager')
const SnapshotManager = require('./SnapshotManager')
const Profiler = require('./Profiler')

module.exports = UpdateManager = {
  processOutstandingUpdates(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const timer = new Metrics.Timer('updateManager.processOutstandingUpdates')
    return UpdateManager.fetchAndApplyUpdates(
      projectId,
      docId,
      function (error) {
        timer.done()
        if (error != null) {
          return callback(error)
        }
        return callback()
      }
    )
  },

  processOutstandingUpdatesWithLock(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const profile = new Profiler('processOutstandingUpdatesWithLock', {
      project_id: projectId,
      doc_id: docId,
    })
    return LockManager.tryLock(docId, (error, gotLock, lockValue) => {
      if (error != null) {
        return callback(error)
      }
      if (!gotLock) {
        return callback()
      }
      profile.log('tryLock')
      return UpdateManager.processOutstandingUpdates(
        projectId,
        docId,
        function (error) {
          if (error != null) {
            return UpdateManager._handleErrorInsideLock(
              docId,
              lockValue,
              error,
              callback
            )
          }
          profile.log('processOutstandingUpdates')
          return LockManager.releaseLock(docId, lockValue, error => {
            if (error != null) {
              return callback(error)
            }
            profile.log('releaseLock').end()
            return UpdateManager.continueProcessingUpdatesWithLock(
              projectId,
              docId,
              callback
            )
          })
        }
      )
    })
  },

  continueProcessingUpdatesWithLock(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RealTimeRedisManager.getUpdatesLength(docId, (error, length) => {
      if (error != null) {
        return callback(error)
      }
      if (length > 0) {
        return UpdateManager.processOutstandingUpdatesWithLock(
          projectId,
          docId,
          callback
        )
      } else {
        return callback()
      }
    })
  },

  fetchAndApplyUpdates(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const profile = new Profiler('fetchAndApplyUpdates', {
      project_id: projectId,
      doc_id: docId,
    })
    return RealTimeRedisManager.getPendingUpdatesForDoc(
      docId,
      (error, updates) => {
        if (error != null) {
          return callback(error)
        }
        logger.debug(
          { projectId, docId, count: updates.length },
          'processing updates'
        )
        if (updates.length === 0) {
          return callback()
        }
        profile.log('getPendingUpdatesForDoc')
        const doUpdate = (update, cb) =>
          UpdateManager.applyUpdate(projectId, docId, update, function (err) {
            profile.log('applyUpdate')
            return cb(err)
          })
        const finalCallback = function (err) {
          profile.log('async done').end()
          return callback(err)
        }
        return async.eachSeries(updates, doUpdate, finalCallback)
      }
    )
  },

  applyUpdate(projectId, docId, update, _callback) {
    if (_callback == null) {
      _callback = function () {}
    }
    const callback = function (error) {
      if (error != null) {
        RealTimeRedisManager.sendData({
          project_id: projectId,
          doc_id: docId,
          error: error.message || error,
        })
        profile.log('sendData')
      }
      profile.end()
      return _callback(error)
    }

    const profile = new Profiler('applyUpdate', {
      project_id: projectId,
      doc_id: docId,
    })
    UpdateManager._sanitizeUpdate(update)
    profile.log('sanitizeUpdate', { sync: true })
    return DocumentManager.getDoc(
      projectId,
      docId,
      function (error, lines, version, ranges, pathname, projectHistoryId) {
        profile.log('getDoc')
        if (error != null) {
          return callback(error)
        }
        if (lines == null || version == null) {
          return callback(
            new Errors.NotFoundError(`document not found: ${docId}`)
          )
        }
        const previousVersion = version
        const incomingUpdateVersion = update.v
        return ShareJsUpdateManager.applyUpdate(
          projectId,
          docId,
          update,
          lines,
          version,
          function (error, updatedDocLines, version, appliedOps) {
            profile.log('sharejs.applyUpdate', {
              // only synchronous when the update applies directly to the
              // doc version, otherwise getPreviousDocOps is called.
              sync: incomingUpdateVersion === previousVersion,
            })
            if (error != null) {
              return callback(error)
            }
            return RangesManager.applyUpdate(
              projectId,
              docId,
              ranges,
              appliedOps,
              updatedDocLines,
              function (error, newRanges, rangesWereCollapsed) {
                UpdateManager._addProjectHistoryMetadataToOps(
                  appliedOps,
                  pathname,
                  projectHistoryId,
                  lines
                )
                profile.log('RangesManager.applyUpdate', { sync: true })
                if (error != null) {
                  return callback(error)
                }
                return RedisManager.updateDocument(
                  projectId,
                  docId,
                  updatedDocLines,
                  version,
                  appliedOps,
                  newRanges,
                  update.meta,
                  function (error, docOpsLength, projectOpsLength) {
                    profile.log('RedisManager.updateDocument')
                    if (error != null) {
                      return callback(error)
                    }
                    return HistoryManager.recordAndFlushHistoryOps(
                      projectId,
                      docId,
                      appliedOps,
                      docOpsLength,
                      projectOpsLength,
                      function (error) {
                        profile.log('recordAndFlushHistoryOps')
                        if (error != null) {
                          return callback(error)
                        }
                        if (rangesWereCollapsed) {
                          Metrics.inc('doc-snapshot')
                          logger.debug(
                            {
                              projectId,
                              docId,
                              previousVersion,
                              lines,
                              ranges,
                              update,
                            },
                            'update collapsed some ranges, snapshotting previous content'
                          )
                          // Do this last, since it's a mongo call, and so potentially longest running
                          // If it overruns the lock, it's ok, since all of our redis work is done
                          return SnapshotManager.recordSnapshot(
                            projectId,
                            docId,
                            previousVersion,
                            pathname,
                            lines,
                            ranges,
                            function (error) {
                              if (error != null) {
                                logger.error(
                                  {
                                    err: error,
                                    projectId,
                                    docId,
                                    version,
                                    lines,
                                    ranges,
                                  },
                                  'error recording snapshot'
                                )
                                return callback(error)
                              } else {
                                return callback()
                              }
                            }
                          )
                        } else {
                          return callback()
                        }
                      }
                    )
                  }
                )
              }
            )
          }
        )
      }
    )
  },

  lockUpdatesAndDo(method, projectId, docId, ...rest) {
    const adjustedLength = Math.max(rest.length, 1)
    const args = rest.slice(0, adjustedLength - 1)
    const callback = rest[adjustedLength - 1]
    const profile = new Profiler('lockUpdatesAndDo', {
      project_id: projectId,
      doc_id: docId,
    })
    return LockManager.getLock(docId, function (error, lockValue) {
      profile.log('getLock')
      if (error != null) {
        return callback(error)
      }
      return UpdateManager.processOutstandingUpdates(
        projectId,
        docId,
        function (error) {
          if (error != null) {
            return UpdateManager._handleErrorInsideLock(
              docId,
              lockValue,
              error,
              callback
            )
          }
          profile.log('processOutstandingUpdates')
          return method(
            projectId,
            docId,
            ...Array.from(args),
            function (error, ...responseArgs) {
              if (error != null) {
                return UpdateManager._handleErrorInsideLock(
                  docId,
                  lockValue,
                  error,
                  callback
                )
              }
              profile.log('method')
              return LockManager.releaseLock(
                docId,
                lockValue,
                function (error) {
                  if (error != null) {
                    return callback(error)
                  }
                  profile.log('releaseLock').end()
                  callback(null, ...Array.from(responseArgs))
                  // We held the lock for a while so updates might have queued up
                  return UpdateManager.continueProcessingUpdatesWithLock(
                    projectId,
                    docId,
                    err => {
                      if (err) {
                        // The processing may fail for invalid user updates.
                        // This can be very noisy, put them on level DEBUG
                        //  and record a metric.
                        Metrics.inc('background-processing-updates-error')
                        logger.debug(
                          { err, projectId, docId },
                          'error processing updates in background'
                        )
                      }
                    }
                  )
                }
              )
            }
          )
        }
      )
    })
  },

  _handleErrorInsideLock(docId, lockValue, originalError, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return LockManager.releaseLock(docId, lockValue, lockError =>
      callback(originalError)
    )
  },

  _sanitizeUpdate(update) {
    // In Javascript, characters are 16-bits wide. It does not understand surrogates as characters.
    //
    // From Wikipedia (http://en.wikipedia.org/wiki/Plane_(Unicode)#Basic_Multilingual_Plane):
    // "The High Surrogates (U+D800–U+DBFF) and Low Surrogate (U+DC00–U+DFFF) codes are reserved
    // for encoding non-BMP characters in UTF-16 by using a pair of 16-bit codes: one High Surrogate
    // and one Low Surrogate. A single surrogate code point will never be assigned a character.""
    //
    // The main offender seems to be \uD835 as a stand alone character, which would be the first
    // 16-bit character of a blackboard bold character (http://www.fileformat.info/info/unicode/char/1d400/index.htm).
    // Something must be going on client side that is screwing up the encoding and splitting the
    // two 16-bit characters so that \uD835 is standalone.
    for (const op of Array.from(update.op || [])) {
      if (op.i != null) {
        // Replace high and low surrogate characters with 'replacement character' (\uFFFD)
        op.i = op.i.replace(/[\uD800-\uDFFF]/g, '\uFFFD')
      }
    }
    return update
  },

  _addProjectHistoryMetadataToOps(updates, pathname, projectHistoryId, lines) {
    let docLength = _.reduce(lines, (chars, line) => chars + line.length, 0)
    docLength += lines.length - 1 // count newline characters
    return updates.forEach(function (update) {
      update.projectHistoryId = projectHistoryId
      if (!update.meta) {
        update.meta = {}
      }
      update.meta.pathname = pathname
      update.meta.doc_length = docLength
      // Each update may contain multiple ops, i.e.
      // [{
      // 	ops: [{i: "foo", p: 4}, {d: "bar", p:8}]
      // }, {
      // 	ops: [{d: "baz", p: 40}, {i: "qux", p:8}]
      // }]
      // We want to include the doc_length at the start of each update,
      // before it's ops are applied. However, we need to track any
      // changes to it for the next update.
      return (() => {
        const result = []
        for (const op of Array.from(update.op)) {
          if (op.i != null) {
            docLength += op.i.length
          }
          if (op.d != null) {
            result.push((docLength -= op.d.length))
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    })
  },
}
