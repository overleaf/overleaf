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
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const Errors = require('./Errors')
const DocumentManager = require('./DocumentManager')
const RangesManager = require('./RangesManager')
const SnapshotManager = require('./SnapshotManager')
const Profiler = require('./Profiler')

module.exports = UpdateManager = {
  processOutstandingUpdates(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const timer = new Metrics.Timer('updateManager.processOutstandingUpdates')
    return UpdateManager.fetchAndApplyUpdates(
      project_id,
      doc_id,
      function (error) {
        timer.done()
        if (error != null) {
          return callback(error)
        }
        return callback()
      }
    )
  },

  processOutstandingUpdatesWithLock(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const profile = new Profiler('processOutstandingUpdatesWithLock', {
      project_id,
      doc_id,
    })
    return LockManager.tryLock(doc_id, (error, gotLock, lockValue) => {
      if (error != null) {
        return callback(error)
      }
      if (!gotLock) {
        return callback()
      }
      profile.log('tryLock')
      return UpdateManager.processOutstandingUpdates(
        project_id,
        doc_id,
        function (error) {
          if (error != null) {
            return UpdateManager._handleErrorInsideLock(
              doc_id,
              lockValue,
              error,
              callback
            )
          }
          profile.log('processOutstandingUpdates')
          return LockManager.releaseLock(doc_id, lockValue, error => {
            if (error != null) {
              return callback(error)
            }
            profile.log('releaseLock').end()
            return UpdateManager.continueProcessingUpdatesWithLock(
              project_id,
              doc_id,
              callback
            )
          })
        }
      )
    })
  },

  continueProcessingUpdatesWithLock(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return RealTimeRedisManager.getUpdatesLength(doc_id, (error, length) => {
      if (error != null) {
        return callback(error)
      }
      if (length > 0) {
        return UpdateManager.processOutstandingUpdatesWithLock(
          project_id,
          doc_id,
          callback
        )
      } else {
        return callback()
      }
    })
  },

  fetchAndApplyUpdates(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const profile = new Profiler('fetchAndApplyUpdates', { project_id, doc_id })
    return RealTimeRedisManager.getPendingUpdatesForDoc(
      doc_id,
      (error, updates) => {
        if (error != null) {
          return callback(error)
        }
        logger.log(
          { project_id, doc_id, count: updates.length },
          'processing updates'
        )
        if (updates.length === 0) {
          return callback()
        }
        profile.log('getPendingUpdatesForDoc')
        const doUpdate = (update, cb) =>
          UpdateManager.applyUpdate(project_id, doc_id, update, function (err) {
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

  applyUpdate(project_id, doc_id, update, _callback) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const callback = function (error) {
      if (error != null) {
        RealTimeRedisManager.sendData({
          project_id,
          doc_id,
          error: error.message || error,
        })
        profile.log('sendData')
      }
      profile.end()
      return _callback(error)
    }

    var profile = new Profiler('applyUpdate', { project_id, doc_id })
    UpdateManager._sanitizeUpdate(update)
    profile.log('sanitizeUpdate')
    return DocumentManager.getDoc(
      project_id,
      doc_id,
      function (error, lines, version, ranges, pathname, projectHistoryId) {
        profile.log('getDoc')
        if (error != null) {
          return callback(error)
        }
        if (lines == null || version == null) {
          return callback(
            new Errors.NotFoundError(`document not found: ${doc_id}`)
          )
        }
        const previousVersion = version
        return ShareJsUpdateManager.applyUpdate(
          project_id,
          doc_id,
          update,
          lines,
          version,
          function (error, updatedDocLines, version, appliedOps) {
            profile.log('sharejs.applyUpdate')
            if (error != null) {
              return callback(error)
            }
            return RangesManager.applyUpdate(
              project_id,
              doc_id,
              ranges,
              appliedOps,
              updatedDocLines,
              function (error, new_ranges, ranges_were_collapsed) {
                UpdateManager._addProjectHistoryMetadataToOps(
                  appliedOps,
                  pathname,
                  projectHistoryId,
                  lines
                )
                profile.log('RangesManager.applyUpdate')
                if (error != null) {
                  return callback(error)
                }
                return RedisManager.updateDocument(
                  project_id,
                  doc_id,
                  updatedDocLines,
                  version,
                  appliedOps,
                  new_ranges,
                  update.meta,
                  function (error, doc_ops_length, project_ops_length) {
                    profile.log('RedisManager.updateDocument')
                    if (error != null) {
                      return callback(error)
                    }
                    return HistoryManager.recordAndFlushHistoryOps(
                      project_id,
                      doc_id,
                      appliedOps,
                      doc_ops_length,
                      project_ops_length,
                      function (error) {
                        profile.log('recordAndFlushHistoryOps')
                        if (error != null) {
                          return callback(error)
                        }
                        if (ranges_were_collapsed) {
                          logger.log(
                            {
                              project_id,
                              doc_id,
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
                            project_id,
                            doc_id,
                            previousVersion,
                            pathname,
                            lines,
                            ranges,
                            function (error) {
                              if (error != null) {
                                logger.error(
                                  {
                                    err: error,
                                    project_id,
                                    doc_id,
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

  lockUpdatesAndDo(method, project_id, doc_id, ...rest) {
    const adjustedLength = Math.max(rest.length, 1)
    const args = rest.slice(0, adjustedLength - 1)
    const callback = rest[adjustedLength - 1]
    const profile = new Profiler('lockUpdatesAndDo', { project_id, doc_id })
    return LockManager.getLock(doc_id, function (error, lockValue) {
      profile.log('getLock')
      if (error != null) {
        return callback(error)
      }
      return UpdateManager.processOutstandingUpdates(
        project_id,
        doc_id,
        function (error) {
          if (error != null) {
            return UpdateManager._handleErrorInsideLock(
              doc_id,
              lockValue,
              error,
              callback
            )
          }
          profile.log('processOutstandingUpdates')
          return method(
            project_id,
            doc_id,
            ...Array.from(args),
            function (error, ...response_args) {
              if (error != null) {
                return UpdateManager._handleErrorInsideLock(
                  doc_id,
                  lockValue,
                  error,
                  callback
                )
              }
              profile.log('method')
              return LockManager.releaseLock(
                doc_id,
                lockValue,
                function (error) {
                  if (error != null) {
                    return callback(error)
                  }
                  profile.log('releaseLock').end()
                  callback(null, ...Array.from(response_args))
                  // We held the lock for a while so updates might have queued up
                  return UpdateManager.continueProcessingUpdatesWithLock(
                    project_id,
                    doc_id
                  )
                }
              )
            }
          )
        }
      )
    })
  },

  _handleErrorInsideLock(doc_id, lockValue, original_error, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return LockManager.releaseLock(doc_id, lockValue, lock_error =>
      callback(original_error)
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
    let doc_length = _.reduce(lines, (chars, line) => chars + line.length, 0)
    doc_length += lines.length - 1 // count newline characters
    return updates.forEach(function (update) {
      update.projectHistoryId = projectHistoryId
      if (!update.meta) {
        update.meta = {}
      }
      update.meta.pathname = pathname
      update.meta.doc_length = doc_length
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
            doc_length += op.i.length
          }
          if (op.d != null) {
            result.push((doc_length -= op.d.length))
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    })
  },
}
