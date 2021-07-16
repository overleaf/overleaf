/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RedisManager
const Settings = require('@overleaf/settings')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const logger = require('logger-sharelatex')
const metrics = require('./Metrics')
const Errors = require('./Errors')
const crypto = require('crypto')
const async = require('async')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')

// Sometimes Redis calls take an unexpectedly long time.  We have to be
// quick with Redis calls because we're holding a lock that expires
// after 30 seconds. We can't let any errors in the rest of the stack
// hold us up, and need to bail out quickly if there is a problem.
const MAX_REDIS_REQUEST_LENGTH = 5000 // 5 seconds

// Make times easy to read
const minutes = 60 // seconds for Redis expire

const logHashErrors =
  Settings.documentupdater != null
    ? Settings.documentupdater.logHashErrors
    : undefined
const logHashReadErrors = logHashErrors != null ? logHashErrors.read : undefined

const MEGABYTES = 1024 * 1024
const MAX_RANGES_SIZE = 3 * MEGABYTES

const keys = Settings.redis.documentupdater.key_schema
const historyKeys = Settings.redis.history.key_schema // note: this is track changes, not project-history

module.exports = RedisManager = {
  rclient,

  putDocInMemory(
    project_id,
    doc_id,
    docLines,
    version,
    ranges,
    pathname,
    projectHistoryId,
    _callback
  ) {
    const timer = new metrics.Timer('redis.put-doc')
    const callback = function (error) {
      timer.done()
      return _callback(error)
    }
    docLines = JSON.stringify(docLines)
    if (docLines.indexOf('\u0000') !== -1) {
      const error = new Error('null bytes found in doc lines')
      // this check was added to catch memory corruption in JSON.stringify.
      // It sometimes returned null bytes at the end of the string.
      logger.error({ err: error, doc_id, docLines }, error.message)
      return callback(error)
    }
    // Do a cheap size check on the serialized blob.
    if (docLines.length > Settings.max_doc_length) {
      const docSize = docLines.length
      const err = new Error('blocking doc insert into redis: doc is too large')
      logger.error({ project_id, doc_id, err, docSize }, err.message)
      return callback(err)
    }
    const docHash = RedisManager._computeHash(docLines)
    // record bytes sent to redis
    metrics.summary('redis.docLines', docLines.length, { status: 'set' })
    logger.log(
      { project_id, doc_id, version, docHash, pathname, projectHistoryId },
      'putting doc in redis'
    )
    return RedisManager._serializeRanges(ranges, function (error, ranges) {
      if (error != null) {
        logger.error({ err: error, doc_id, project_id }, error.message)
        return callback(error)
      }
      // update docsInProject set before writing doc contents
      rclient.sadd(keys.docsInProject({ project_id }), doc_id, error => {
        if (error) return callback(error)

        rclient.mset(
          {
            [keys.docLines({ doc_id })]: docLines,
            [keys.projectKey({ doc_id })]: project_id,
            [keys.docVersion({ doc_id })]: version,
            [keys.docHash({ doc_id })]: docHash,
            [keys.ranges({ doc_id })]: ranges,
            [keys.pathname({ doc_id })]: pathname,
            [keys.projectHistoryId({ doc_id })]: projectHistoryId,
          },
          callback
        )
      })
    })
  },

  removeDocFromMemory(project_id, doc_id, _callback) {
    logger.log({ project_id, doc_id }, 'removing doc from redis')
    const callback = function (err) {
      if (err != null) {
        logger.err({ project_id, doc_id, err }, 'error removing doc from redis')
        return _callback(err)
      } else {
        logger.log({ project_id, doc_id }, 'removed doc from redis')
        return _callback()
      }
    }

    let multi = rclient.multi()
    multi.strlen(keys.docLines({ doc_id }))
    multi.del(
      keys.docLines({ doc_id }),
      keys.projectKey({ doc_id }),
      keys.docVersion({ doc_id }),
      keys.docHash({ doc_id }),
      keys.ranges({ doc_id }),
      keys.pathname({ doc_id }),
      keys.projectHistoryId({ doc_id }),
      keys.projectHistoryType({ doc_id }),
      keys.unflushedTime({ doc_id }),
      keys.lastUpdatedAt({ doc_id }),
      keys.lastUpdatedBy({ doc_id })
    )
    return multi.exec(function (error, response) {
      if (error != null) {
        return callback(error)
      }
      const length = response != null ? response[0] : undefined
      if (length > 0) {
        // record bytes freed in redis
        metrics.summary('redis.docLines', length, { status: 'del' })
      }
      multi = rclient.multi()
      multi.srem(keys.docsInProject({ project_id }), doc_id)
      multi.del(keys.projectState({ project_id }))
      return multi.exec(callback)
    })
  },

  checkOrSetProjectState(project_id, newState, callback) {
    if (callback == null) {
      callback = function (error, stateChanged) {}
    }
    const multi = rclient.multi()
    multi.getset(keys.projectState({ project_id }), newState)
    multi.expire(keys.projectState({ project_id }), 30 * minutes)
    return multi.exec(function (error, response) {
      if (error != null) {
        return callback(error)
      }
      logger.log(
        { project_id, newState, oldState: response[0] },
        'checking project state'
      )
      return callback(null, response[0] !== newState)
    })
  },

  clearProjectState(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return rclient.del(keys.projectState({ project_id }), callback)
  },

  getDoc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime
      ) {}
    }
    const timer = new metrics.Timer('redis.get-doc')
    const collectKeys = [
      keys.docLines({ doc_id }),
      keys.docVersion({ doc_id }),
      keys.docHash({ doc_id }),
      keys.projectKey({ doc_id }),
      keys.ranges({ doc_id }),
      keys.pathname({ doc_id }),
      keys.projectHistoryId({ doc_id }),
      keys.unflushedTime({ doc_id }),
      keys.lastUpdatedAt({ doc_id }),
      keys.lastUpdatedBy({ doc_id }),
    ]
    rclient.mget(...collectKeys, (error, ...rest) => {
      let [
        docLines,
        version,
        storedHash,
        doc_project_id,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        lastUpdatedAt,
        lastUpdatedBy,
      ] = Array.from(rest[0])
      const timeSpan = timer.done()
      if (error != null) {
        return callback(error)
      }
      // check if request took too long and bail out.  only do this for
      // get, because it is the first call in each update, so if this
      // passes we'll assume others have a reasonable chance to succeed.
      if (timeSpan > MAX_REDIS_REQUEST_LENGTH) {
        error = new Error('redis getDoc exceeded timeout')
        return callback(error)
      }
      // record bytes loaded from redis
      if (docLines != null) {
        metrics.summary('redis.docLines', docLines.length, { status: 'get' })
      }
      // check sha1 hash value if present
      if (docLines != null && storedHash != null) {
        const computedHash = RedisManager._computeHash(docLines)
        if (logHashReadErrors && computedHash !== storedHash) {
          logger.error(
            {
              project_id,
              doc_id,
              doc_project_id,
              computedHash,
              storedHash,
              docLines,
            },
            'hash mismatch on retrieved document'
          )
        }
      }

      try {
        docLines = JSON.parse(docLines)
        ranges = RedisManager._deserializeRanges(ranges)
      } catch (e) {
        return callback(e)
      }

      version = parseInt(version || 0, 10)
      // check doc is in requested project
      if (doc_project_id != null && doc_project_id !== project_id) {
        logger.error(
          { project_id, doc_id, doc_project_id },
          'doc not in project'
        )
        return callback(new Errors.NotFoundError('document not found'))
      }

      if (projectHistoryId != null) {
        projectHistoryId = parseInt(projectHistoryId)
      }

      callback(
        null,
        docLines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        unflushedTime,
        lastUpdatedAt,
        lastUpdatedBy
      )
    })
  },

  getDocVersion(doc_id, callback) {
    if (callback == null) {
      callback = function (error, version, projectHistoryType) {}
    }
    return rclient.mget(
      keys.docVersion({ doc_id }),
      keys.projectHistoryType({ doc_id }),
      function (error, result) {
        if (error != null) {
          return callback(error)
        }
        let [version, projectHistoryType] = Array.from(result || [])
        version = parseInt(version, 10)
        return callback(null, version, projectHistoryType)
      }
    )
  },

  getDocLines(doc_id, callback) {
    if (callback == null) {
      callback = function (error, version) {}
    }
    return rclient.get(keys.docLines({ doc_id }), function (error, docLines) {
      if (error != null) {
        return callback(error)
      }
      return callback(null, docLines)
    })
  },

  getPreviousDocOps(doc_id, start, end, callback) {
    if (callback == null) {
      callback = function (error, jsonOps) {}
    }
    const timer = new metrics.Timer('redis.get-prev-docops')
    return rclient.llen(keys.docOps({ doc_id }), function (error, length) {
      if (error != null) {
        return callback(error)
      }
      return rclient.get(
        keys.docVersion({ doc_id }),
        function (error, version) {
          if (error != null) {
            return callback(error)
          }
          version = parseInt(version, 10)
          const first_version_in_redis = version - length

          if (start < first_version_in_redis || end > version) {
            error = new Errors.OpRangeNotAvailableError(
              'doc ops range is not loaded in redis'
            )
            logger.warn(
              { err: error, doc_id, length, version, start, end },
              'doc ops range is not loaded in redis'
            )
            return callback(error)
          }

          start = start - first_version_in_redis
          if (end > -1) {
            end = end - first_version_in_redis
          }

          if (isNaN(start) || isNaN(end)) {
            error = new Error('inconsistent version or lengths')
            logger.error(
              { err: error, doc_id, length, version, start, end },
              'inconsistent version or length'
            )
            return callback(error)
          }

          return rclient.lrange(
            keys.docOps({ doc_id }),
            start,
            end,
            function (error, jsonOps) {
              let ops
              if (error != null) {
                return callback(error)
              }
              try {
                ops = jsonOps.map(jsonOp => JSON.parse(jsonOp))
              } catch (e) {
                return callback(e)
              }
              const timeSpan = timer.done()
              if (timeSpan > MAX_REDIS_REQUEST_LENGTH) {
                error = new Error('redis getPreviousDocOps exceeded timeout')
                return callback(error)
              }
              return callback(null, ops)
            }
          )
        }
      )
    })
  },

  getHistoryType(doc_id, callback) {
    if (callback == null) {
      callback = function (error, projectHistoryType) {}
    }
    return rclient.get(
      keys.projectHistoryType({ doc_id }),
      function (error, projectHistoryType) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, projectHistoryType)
      }
    )
  },

  setHistoryType(doc_id, projectHistoryType, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return rclient.set(
      keys.projectHistoryType({ doc_id }),
      projectHistoryType,
      callback
    )
  },

  DOC_OPS_TTL: 60 * minutes,
  DOC_OPS_MAX_LENGTH: 100,
  updateDocument(
    project_id,
    doc_id,
    docLines,
    newVersion,
    appliedOps,
    ranges,
    updateMeta,
    callback
  ) {
    if (appliedOps == null) {
      appliedOps = []
    }
    if (callback == null) {
      callback = function (error) {}
    }
    return RedisManager.getDocVersion(
      doc_id,
      function (error, currentVersion, projectHistoryType) {
        if (error != null) {
          return callback(error)
        }
        if (currentVersion + appliedOps.length !== newVersion) {
          error = new Error(`Version mismatch. '${doc_id}' is corrupted.`)
          logger.error(
            {
              err: error,
              doc_id,
              currentVersion,
              newVersion,
              opsLength: appliedOps.length,
            },
            'version mismatch'
          )
          return callback(error)
        }

        const jsonOps = appliedOps.map(op => JSON.stringify(op))
        for (const op of Array.from(jsonOps)) {
          if (op.indexOf('\u0000') !== -1) {
            error = new Error('null bytes found in jsonOps')
            // this check was added to catch memory corruption in JSON.stringify
            logger.error({ err: error, doc_id, jsonOps }, error.message)
            return callback(error)
          }
        }

        const newDocLines = JSON.stringify(docLines)
        if (newDocLines.indexOf('\u0000') !== -1) {
          error = new Error('null bytes found in doc lines')
          // this check was added to catch memory corruption in JSON.stringify
          logger.error({ err: error, doc_id, newDocLines }, error.message)
          return callback(error)
        }
        // Do a cheap size check on the serialized blob.
        if (newDocLines.length > Settings.max_doc_length) {
          const err = new Error('blocking doc update: doc is too large')
          const docSize = newDocLines.length
          logger.error({ project_id, doc_id, err, docSize }, err.message)
          return callback(err)
        }
        const newHash = RedisManager._computeHash(newDocLines)

        const opVersions = appliedOps.map(op => (op != null ? op.v : undefined))
        logger.log(
          {
            doc_id,
            version: newVersion,
            hash: newHash,
            op_versions: opVersions,
          },
          'updating doc in redis'
        )
        // record bytes sent to redis in update
        metrics.summary('redis.docLines', newDocLines.length, {
          status: 'update',
        })
        return RedisManager._serializeRanges(ranges, function (error, ranges) {
          if (error != null) {
            logger.error({ err: error, doc_id }, error.message)
            return callback(error)
          }
          if (ranges != null && ranges.indexOf('\u0000') !== -1) {
            error = new Error('null bytes found in ranges')
            // this check was added to catch memory corruption in JSON.stringify
            logger.error({ err: error, doc_id, ranges }, error.message)
            return callback(error)
          }
          const multi = rclient.multi()
          multi.mset({
            [keys.docLines({ doc_id })]: newDocLines,
            [keys.docVersion({ doc_id })]: newVersion,
            [keys.docHash({ doc_id })]: newHash,
            [keys.ranges({ doc_id })]: ranges,
            [keys.lastUpdatedAt({ doc_id })]: Date.now(),
            [keys.lastUpdatedBy({ doc_id })]: updateMeta && updateMeta.user_id,
          })
          multi.ltrim(
            keys.docOps({ doc_id }),
            -RedisManager.DOC_OPS_MAX_LENGTH,
            -1
          ) // index 3
          // push the ops last so we can get the lengths at fixed index position 7
          if (jsonOps.length > 0) {
            multi.rpush(keys.docOps({ doc_id }), ...Array.from(jsonOps)) // index 5
            // expire must come after rpush since before it will be a no-op if the list is empty
            multi.expire(keys.docOps({ doc_id }), RedisManager.DOC_OPS_TTL) // index 6
            if (projectHistoryType === 'project-history') {
              metrics.inc('history-queue', 1, { status: 'skip-track-changes' })
              logger.log(
                { doc_id },
                'skipping push of uncompressed ops for project using project-history'
              )
            } else {
              // project is using old track-changes history service
              metrics.inc('history-queue', 1, { status: 'track-changes' })
              multi.rpush(
                historyKeys.uncompressedHistoryOps({ doc_id }),
                ...Array.from(jsonOps)
              ) // index 7
            }
            // Set the unflushed timestamp to the current time if the doc
            // hasn't been modified before (the content in mongo has been
            // valid up to this point). Otherwise leave it alone ("NX" flag).
            multi.set(keys.unflushedTime({ doc_id }), Date.now(), 'NX')
          }
          return multi.exec(function (error, result) {
            let docUpdateCount
            if (error != null) {
              return callback(error)
            }

            if (projectHistoryType === 'project-history') {
              docUpdateCount = undefined // only using project history, don't bother with track-changes
            } else {
              // project is using old track-changes history service
              docUpdateCount = result[4]
            }

            if (
              jsonOps.length > 0 &&
              __guard__(
                Settings.apis != null
                  ? Settings.apis.project_history
                  : undefined,
                x => x.enabled
              )
            ) {
              metrics.inc('history-queue', 1, { status: 'project-history' })
              return ProjectHistoryRedisManager.queueOps(
                project_id,
                ...Array.from(jsonOps),
                (error, projectUpdateCount) =>
                  callback(null, docUpdateCount, projectUpdateCount)
              )
            } else {
              return callback(null, docUpdateCount)
            }
          })
        })
      }
    )
  },

  renameDoc(project_id, doc_id, user_id, update, projectHistoryId, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return RedisManager.getDoc(
      project_id,
      doc_id,
      function (error, lines, version) {
        if (error != null) {
          return callback(error)
        }

        if (lines != null && version != null) {
          return rclient.set(
            keys.pathname({ doc_id }),
            update.newPathname,
            function (error) {
              if (error != null) {
                return callback(error)
              }
              return ProjectHistoryRedisManager.queueRenameEntity(
                project_id,
                projectHistoryId,
                'doc',
                doc_id,
                user_id,
                update,
                callback
              )
            }
          )
        } else {
          return ProjectHistoryRedisManager.queueRenameEntity(
            project_id,
            projectHistoryId,
            'doc',
            doc_id,
            user_id,
            update,
            callback
          )
        }
      }
    )
  },

  clearUnflushedTime(doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return rclient.del(keys.unflushedTime({ doc_id }), callback)
  },

  getDocIdsInProject(project_id, callback) {
    if (callback == null) {
      callback = function (error, doc_ids) {}
    }
    return rclient.smembers(keys.docsInProject({ project_id }), callback)
  },

  getDocTimestamps(doc_ids, callback) {
    // get lastupdatedat timestamps for an array of doc_ids
    if (callback == null) {
      callback = function (error, result) {}
    }
    return async.mapSeries(
      doc_ids,
      (doc_id, cb) => rclient.get(keys.lastUpdatedAt({ doc_id }), cb),
      callback
    )
  },

  queueFlushAndDeleteProject(project_id, callback) {
    // store the project id in a sorted set ordered by time with a random offset to smooth out spikes
    const SMOOTHING_OFFSET =
      Settings.smoothingOffset > 0
        ? Math.round(Settings.smoothingOffset * Math.random())
        : 0
    return rclient.zadd(
      keys.flushAndDeleteQueue(),
      Date.now() + SMOOTHING_OFFSET,
      project_id,
      callback
    )
  },

  getNextProjectToFlushAndDelete(cutoffTime, callback) {
    // find the oldest queued flush that is before the cutoff time
    if (callback == null) {
      callback = function (error, key, timestamp) {}
    }
    return rclient.zrangebyscore(
      keys.flushAndDeleteQueue(),
      0,
      cutoffTime,
      'WITHSCORES',
      'LIMIT',
      0,
      1,
      function (err, reply) {
        if (err != null) {
          return callback(err)
        }
        if (!(reply != null ? reply.length : undefined)) {
          return callback()
        } // return if no projects ready to be processed
        // pop the oldest entry (get and remove in a multi)
        const multi = rclient.multi()
        // Poor man's version of ZPOPMIN, which is only available in Redis 5.
        multi.zrange(keys.flushAndDeleteQueue(), 0, 0, 'WITHSCORES')
        multi.zremrangebyrank(keys.flushAndDeleteQueue(), 0, 0)
        multi.zcard(keys.flushAndDeleteQueue()) // the total length of the queue (for metrics)
        return multi.exec(function (err, reply) {
          if (err != null) {
            return callback(err)
          }
          if (!(reply != null ? reply.length : undefined)) {
            return callback()
          }
          const [key, timestamp] = Array.from(reply[0])
          const queueLength = reply[2]
          return callback(null, key, timestamp, queueLength)
        })
      }
    )
  },

  _serializeRanges(ranges, callback) {
    if (callback == null) {
      callback = function (error, serializedRanges) {}
    }
    let jsonRanges = JSON.stringify(ranges)
    if (jsonRanges != null && jsonRanges.length > MAX_RANGES_SIZE) {
      return callback(new Error('ranges are too large'))
    }
    if (jsonRanges === '{}') {
      // Most doc will have empty ranges so don't fill redis with lots of '{}' keys
      jsonRanges = null
    }
    return callback(null, jsonRanges)
  },

  _deserializeRanges(ranges) {
    if (ranges == null || ranges === '') {
      return {}
    } else {
      return JSON.parse(ranges)
    }
  },

  _computeHash(docLines) {
    // use sha1 checksum of doclines to detect data corruption.
    //
    // note: must specify 'utf8' encoding explicitly, as the default is
    // binary in node < v5
    return crypto.createHash('sha1').update(docLines, 'utf8').digest('hex')
  },
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
