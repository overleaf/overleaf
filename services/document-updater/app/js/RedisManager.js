const Settings = require('@overleaf/settings')
const RedisWrapper = require('@overleaf/redis-wrapper')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const { callbackifyAll } = require('@overleaf/promise-utils')
const metrics = require('./Metrics')
const Errors = require('./Errors')
const crypto = require('node:crypto')
const { docIsTooLarge } = require('./Limits')

const rclient = RedisWrapper.createClient(Settings.redis.documentupdater)

// Sometimes Redis calls take an unexpectedly long time.  We have to be
// quick with Redis calls because we're holding a lock that expires
// after 30 seconds. We can't let any errors in the rest of the stack
// hold us up, and need to bail out quickly if there is a problem.
const MAX_REDIS_REQUEST_LENGTH = 5000 // 5 seconds
const PROJECT_BLOCK_TTL_SECS = 30

// Make times easy to read
const minutes = 60 // seconds for Redis expire

const logHashReadErrors = Settings.documentupdater?.logHashErrors?.read

const MEGABYTES = 1024 * 1024
const MAX_RANGES_SIZE = 3 * MEGABYTES

const keys = Settings.redis.documentupdater.key_schema

const RedisManager = {
  async putDocInMemory(
    projectId,
    docId,
    docLines,
    version,
    ranges,
    resolvedCommentIds,
    pathname,
    projectHistoryId,
    historyRangesSupport
  ) {
    const timer = new metrics.Timer('redis.put-doc')
    const shareJSTextOT = Array.isArray(docLines)
    const docLinesArray = docLines
    docLines = JSON.stringify(docLines)
    if (docLines.indexOf('\u0000') !== -1) {
      // this check was added to catch memory corruption in JSON.stringify.
      // It sometimes returned null bytes at the end of the string.
      throw new OError('null bytes found in doc lines', { docId })
    }
    // Do an optimised size check on the docLines using the serialised
    // length as an upper bound
    const sizeBound = docLines.length
    if (
      shareJSTextOT && // editor-core has a size check in TextOperation.apply and TextOperation.applyToLength.
      docIsTooLarge(sizeBound, docLinesArray, Settings.max_doc_length)
    ) {
      const docSize = docLines.length
      throw new OError('blocking doc insert into redis: doc is too large', {
        projectId,
        docId,
        docSize,
      })
    }
    const docHash = RedisManager._computeHash(docLines)
    // record bytes sent to redis
    metrics.summary('redis.docLines', docLines.length, { status: 'set' })
    logger.debug(
      { projectId, docId, version, docHash, pathname, projectHistoryId },
      'putting doc in redis'
    )
    ranges = RedisManager._serializeRanges(ranges)

    // update docsInProject set before writing doc contents
    const projectBlockMulti = rclient.multi()
    projectBlockMulti.exists(keys.projectBlock({ project_id: projectId }))
    projectBlockMulti.sadd(keys.docsInProject({ project_id: projectId }), docId)
    const reply = await projectBlockMulti.exec()
    const projectBlocked = reply[0] === 1
    if (projectBlocked) {
      // We don't clean up the spurious docId added in the docsInProject
      // set. There is a risk that the docId was successfully added by a
      // concurrent process.  This set is used when unloading projects. An
      // extra docId will not prevent the project from being uploaded, but
      // a missing docId means that the doc might stay in Redis forever.
      throw new OError('Project blocked from loading docs', { projectId })
    }

    await RedisManager.setHistoryRangesSupportFlag(docId, historyRangesSupport)

    if (!pathname) {
      metrics.inc('pathname', 1, {
        path: 'RedisManager.setDoc',
        status: pathname === '' ? 'zero-length' : 'undefined',
      })
    }

    // Make sure that this MULTI operation only operates on doc
    // specific keys, i.e. keys that have the doc id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    const multi = rclient.multi()
    multi.mset({
      [keys.docLines({ doc_id: docId })]: docLines,
      [keys.projectKey({ doc_id: docId })]: projectId,
      [keys.docVersion({ doc_id: docId })]: version,
      [keys.docHash({ doc_id: docId })]: docHash,
      [keys.ranges({ doc_id: docId })]: ranges,
      [keys.pathname({ doc_id: docId })]: pathname,
      [keys.projectHistoryId({ doc_id: docId })]: projectHistoryId,
    })
    if (historyRangesSupport) {
      multi.del(keys.resolvedCommentIds({ doc_id: docId }))
      if (resolvedCommentIds.length > 0) {
        multi.sadd(
          keys.resolvedCommentIds({ doc_id: docId }),
          ...resolvedCommentIds
        )
      }
    }

    try {
      await multi.exec()
    } catch (err) {
      throw OError.tag(err, 'failed to write doc to Redis in MULTI', {
        previousErrors: err.previousErrors.map(e => ({
          name: e.name,
          message: e.message,
          command: e.command,
        })),
      })
    }
    timer.done()
  },

  async removeDocFromMemory(projectId, docId) {
    logger.debug({ projectId, docId }, 'removing doc from redis')

    // Make sure that this MULTI operation only operates on doc
    // specific keys, i.e. keys that have the doc id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    let multi = rclient.multi()
    multi.strlen(keys.docLines({ doc_id: docId }))
    multi.del(
      keys.docLines({ doc_id: docId }),
      keys.projectKey({ doc_id: docId }),
      keys.docVersion({ doc_id: docId }),
      keys.docHash({ doc_id: docId }),
      keys.ranges({ doc_id: docId }),
      keys.pathname({ doc_id: docId }),
      keys.projectHistoryId({ doc_id: docId }),
      keys.unflushedTime({ doc_id: docId }),
      keys.lastUpdatedAt({ doc_id: docId }),
      keys.lastUpdatedBy({ doc_id: docId }),
      keys.resolvedCommentIds({ doc_id: docId })
    )
    const response = await multi.exec()
    const length = response?.[0]
    if (length > 0) {
      // record bytes freed in redis
      metrics.summary('redis.docLines', length, { status: 'del' })
    }

    // Make sure that this MULTI operation only operates on project
    // specific keys, i.e. keys that have the project id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    multi = rclient.multi()
    multi.srem(keys.docsInProject({ project_id: projectId }), docId)
    multi.del(keys.projectState({ project_id: projectId }))
    await multi.exec()

    await rclient.srem(keys.historyRangesSupport(), docId)
  },

  async checkOrSetProjectState(projectId, newState) {
    // Make sure that this MULTI operation only operates on project
    // specific keys, i.e. keys that have the project id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    const multi = rclient.multi()
    multi.getset(keys.projectState({ project_id: projectId }), newState)
    multi.expire(keys.projectState({ project_id: projectId }), 30 * minutes)
    const response = await multi.exec()
    logger.debug(
      { projectId, newState, oldState: response[0] },
      'checking project state'
    )
    return response[0] !== newState
  },

  async clearProjectState(projectId) {
    await rclient.del(keys.projectState({ project_id: projectId }))
  },

  async getDoc(projectId, docId) {
    const timer = new metrics.Timer('redis.get-doc')
    const collectKeys = [
      keys.docLines({ doc_id: docId }),
      keys.docVersion({ doc_id: docId }),
      keys.docHash({ doc_id: docId }),
      keys.projectKey({ doc_id: docId }),
      keys.ranges({ doc_id: docId }),
      keys.pathname({ doc_id: docId }),
      keys.projectHistoryId({ doc_id: docId }),
      keys.unflushedTime({ doc_id: docId }),
      keys.lastUpdatedAt({ doc_id: docId }),
      keys.lastUpdatedBy({ doc_id: docId }),
    ]
    let [
      docLines,
      version,
      storedHash,
      docProjectId,
      ranges,
      pathname,
      projectHistoryId,
      unflushedTime,
      lastUpdatedAt,
      lastUpdatedBy,
    ] = await rclient.mget(...collectKeys)
    const result = await rclient.sismember(keys.historyRangesSupport(), docId)
    const historyRangesSupport = result === 1

    const resolvedCommentIds = await rclient.smembers(
      keys.resolvedCommentIds({ doc_id: docId })
    )

    const timeSpan = timer.done()
    // check if request took too long and bail out.  only do this for
    // get, because it is the first call in each update, so if this
    // passes we'll assume others have a reasonable chance to succeed.
    if (timeSpan > MAX_REDIS_REQUEST_LENGTH) {
      throw new OError('redis getDoc exceeded timeout', { projectId, docId })
    }
    // record bytes loaded from redis
    if (docLines != null) {
      metrics.summary('redis.docLines', docLines.length, {
        status: 'get',
      })
    }
    // check sha1 hash value if present
    if (docLines != null && storedHash != null) {
      const computedHash = RedisManager._computeHash(docLines)
      if (logHashReadErrors && computedHash !== storedHash) {
        logger.error(
          {
            projectId,
            docId,
            docProjectId,
            computedHash,
            storedHash,
            docLines,
          },
          'hash mismatch on retrieved document'
        )
      }
    }

    docLines = JSON.parse(docLines)
    ranges = RedisManager._deserializeRanges(ranges)

    version = parseInt(version || 0, 10)
    // check doc is in requested project
    if (docProjectId != null && docProjectId !== projectId) {
      throw new Errors.NotFoundError('document not found', {
        projectId,
        docId,
        docProjectId,
      })
    }

    if (docLines && version && !pathname) {
      metrics.inc('pathname', 1, {
        path: 'RedisManager.getDoc',
        status: pathname === '' ? 'zero-length' : 'undefined',
      })
    }

    return {
      lines: docLines,
      version,
      ranges,
      pathname,
      projectHistoryId,
      unflushedTime,
      lastUpdatedAt,
      lastUpdatedBy,
      historyRangesSupport,
      resolvedCommentIds,
    }
  },

  async getDocRanges(docId) {
    const json = await rclient.get(keys.ranges({ doc_id: docId }))
    const ranges = RedisManager._deserializeRanges(json)
    return ranges
  },

  async getDocVersion(docId) {
    const result = await rclient.mget(keys.docVersion({ doc_id: docId }))
    let [version] = result || []
    version = parseInt(version, 10)
    return version
  },

  async getDocLines(docId) {
    const docLines = await rclient.get(keys.docLines({ doc_id: docId }))
    return docLines
  },

  async getPreviousDocOps(docId, start, end) {
    const timer = new metrics.Timer('redis.get-prev-docops')
    const length = await rclient.llen(keys.docOps({ doc_id: docId }))
    let version = await rclient.get(keys.docVersion({ doc_id: docId }))
    version = parseInt(version, 10)
    const firstVersionInRedis = version - length

    if (start < firstVersionInRedis || end > version) {
      throw new Errors.OpRangeNotAvailableError(
        'doc ops range is not loaded in redis',
        { firstVersionInRedis, version, ttlInS: RedisManager.DOC_OPS_TTL }
      )
    }

    start = start - firstVersionInRedis
    if (end > -1) {
      end = end - firstVersionInRedis
    }

    if (isNaN(start) || isNaN(end)) {
      throw new OError('inconsistent version or lengths', {
        docId,
        length,
        version,
        start,
        end,
      })
    }

    const jsonOps = await rclient.lrange(
      keys.docOps({ doc_id: docId }),
      start,
      end
    )
    const ops = jsonOps.map(jsonOp => JSON.parse(jsonOp))
    const timeSpan = timer.done()
    if (timeSpan > MAX_REDIS_REQUEST_LENGTH) {
      throw new Error('redis getPreviousDocOps exceeded timeout')
    }
    return ops
  },

  DOC_OPS_TTL: 60 * minutes,
  DOC_OPS_MAX_LENGTH: 100,
  async updateDocument(
    projectId,
    docId,
    docLines,
    newVersion,
    appliedOps,
    ranges,
    updateMeta
  ) {
    if (appliedOps == null) {
      appliedOps = []
    }
    const shareJSTextOT = Array.isArray(docLines)
    const currentVersion = await RedisManager.getDocVersion(docId)
    if (currentVersion + appliedOps.length !== newVersion) {
      throw new OError(`Version mismatch. '${docId}' is corrupted.`, {
        docId,
        currentVersion,
        newVersion,
        opsLength: appliedOps.length,
      })
    }

    const jsonOps = appliedOps.map(op => JSON.stringify(op))
    for (const op of jsonOps) {
      if (op.indexOf('\u0000') !== -1) {
        // this check was added to catch memory corruption in JSON.stringify
        throw new OError('null bytes found in jsonOps', {
          docId,
          jsonOps,
        })
      }
    }

    const newDocLines = JSON.stringify(docLines)
    if (newDocLines.indexOf('\u0000') !== -1) {
      // this check was added to catch memory corruption in JSON.stringify
      throw new OError('null bytes found in doc lines', {
        docId,
        newDocLines,
      })
    }
    // Do an optimised size check on the docLines using the serialised
    // length as an upper bound
    const sizeBound = newDocLines.length
    if (
      shareJSTextOT && // editor-core has a size check in TextOperation.apply and TextOperation.applyToLength.
      docIsTooLarge(sizeBound, docLines, Settings.max_doc_length)
    ) {
      const docSize = newDocLines.length
      throw new OError('blocking doc update: doc is too large', {
        projectId,
        docId,
        docSize,
      })
    }
    const newHash = RedisManager._computeHash(newDocLines)

    const opVersions = appliedOps.map(op => op?.v)
    logger.debug(
      {
        docId,
        version: newVersion,
        hash: newHash,
        opVersions,
      },
      'updating doc in redis'
    )
    // record bytes sent to redis in update
    metrics.summary('redis.docLines', newDocLines.length, {
      status: 'update',
    })
    const jsonRanges = RedisManager._serializeRanges(ranges)
    if (jsonRanges && jsonRanges.indexOf('\u0000') !== -1) {
      // this check was added to catch memory corruption in JSON.stringify
      throw new OError('null bytes found in ranges', { docId })
    }

    // Make sure that this MULTI operation only operates on doc
    // specific keys, i.e. keys that have the doc id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    const multi = rclient.multi()
    multi.mset({
      [keys.docLines({ doc_id: docId })]: newDocLines,
      [keys.docVersion({ doc_id: docId })]: newVersion,
      [keys.docHash({ doc_id: docId })]: newHash,
      [keys.ranges({ doc_id: docId })]: jsonRanges,
      [keys.lastUpdatedAt({ doc_id: docId })]: Date.now(),
      [keys.lastUpdatedBy({ doc_id: docId })]: updateMeta && updateMeta.user_id,
    })
    multi.ltrim(
      keys.docOps({ doc_id: docId }),
      -RedisManager.DOC_OPS_MAX_LENGTH,
      -1
    ) // index 3
    // push the ops last so we can get the lengths at fixed index position 7
    if (jsonOps.length > 0) {
      multi.rpush(keys.docOps({ doc_id: docId }), ...jsonOps) // index 5
      // expire must come after rpush since before it will be a no-op if the list is empty
      multi.expire(keys.docOps({ doc_id: docId }), RedisManager.DOC_OPS_TTL) // index 6
    }
    // Set the unflushed timestamp to the current time if not set ("NX" flag).
    multi.set(keys.unflushedTime({ doc_id: docId }), Date.now(), 'NX')
    await multi.exec()
  },

  async renameDoc(projectId, docId, userId, update, projectHistoryId) {
    const { lines, version } = await RedisManager.getDoc(projectId, docId)
    if (lines != null && version != null) {
      if (!update.newPathname) {
        logger.warn(
          { projectId, docId, update },
          'missing pathname in RedisManager.renameDoc'
        )
        metrics.inc('pathname', 1, {
          path: 'RedisManager.renameDoc',
          status: update.newPathname === '' ? 'zero-length' : 'undefined',
        })
      }
      await rclient.set(keys.pathname({ doc_id: docId }), update.newPathname)
    }
  },

  async clearUnflushedTime(docId) {
    await rclient.del(keys.unflushedTime({ doc_id: docId }))
  },

  async updateCommentState(docId, commentId, resolved) {
    if (resolved) {
      await rclient.sadd(keys.resolvedCommentIds({ doc_id: docId }), commentId)
    } else {
      await rclient.srem(keys.resolvedCommentIds({ doc_id: docId }), commentId)
    }
  },

  async getDocIdsInProject(projectId) {
    return await rclient.smembers(keys.docsInProject({ project_id: projectId }))
  },

  /**
   * Get lastupdatedat timestamps for an array of docIds
   */
  async getDocTimestamps(docIds) {
    const timestamps = []
    for (const docId of docIds) {
      const timestamp = await rclient.get(keys.lastUpdatedAt({ doc_id: docId }))
      timestamps.push(timestamp)
    }
    return timestamps
  },

  /**
   * Store the project id in a sorted set ordered by time with a random offset
   * to smooth out spikes
   */
  async queueFlushAndDeleteProject(projectId) {
    const SMOOTHING_OFFSET =
      Settings.smoothingOffset > 0
        ? Math.round(Settings.smoothingOffset * Math.random())
        : 0
    await rclient.zadd(
      keys.flushAndDeleteQueue(),
      Date.now() + SMOOTHING_OFFSET,
      projectId
    )
  },

  /**
   * Find the oldest queued flush that is before the cutoff time
   */
  async getNextProjectToFlushAndDelete(cutoffTime) {
    const projectsReady = await rclient.zrangebyscore(
      keys.flushAndDeleteQueue(),
      0,
      cutoffTime,
      'WITHSCORES',
      'LIMIT',
      0,
      1
    )
    // return if no projects ready to be processed
    if (!projectsReady || projectsReady.length === 0) {
      return {}
    }
    // pop the oldest entry (get and remove in a multi)
    const multi = rclient.multi()
    // Poor man's version of ZPOPMIN, which is only available in Redis 5.
    multi.zrange(keys.flushAndDeleteQueue(), 0, 0, 'WITHSCORES')
    multi.zremrangebyrank(keys.flushAndDeleteQueue(), 0, 0)
    multi.zcard(keys.flushAndDeleteQueue()) // the total length of the queue (for metrics)
    const reply = await multi.exec()
    if (!reply || reply.length === 0) {
      return {}
    }
    const [key, timestamp] = reply[0]
    const queueLength = reply[2]
    return { projectId: key, flushTimestamp: timestamp, queueLength }
  },

  async setHistoryRangesSupportFlag(docId, historyRangesSupport) {
    if (historyRangesSupport) {
      await rclient.sadd(keys.historyRangesSupport(), docId)
    } else {
      await rclient.srem(keys.historyRangesSupport(), docId)
    }
  },

  async blockProject(projectId) {
    // Make sure that this MULTI operation only operates on project
    // specific keys, i.e. keys that have the project id in curly braces.
    // The curly braces identify a hash key for Redis and ensures that
    // the MULTI's operations are all done on the same node in a
    // cluster environment.
    const multi = rclient.multi()
    multi.setex(
      keys.projectBlock({ project_id: projectId }),
      PROJECT_BLOCK_TTL_SECS,
      '1'
    )
    multi.scard(keys.docsInProject({ project_id: projectId }))
    const reply = await multi.exec()
    const docsInProject = reply[1]
    if (docsInProject > 0) {
      // Too late to lock the project
      await rclient.del(keys.projectBlock({ project_id: projectId }))
      return false
    }
    return true
  },

  async unblockProject(projectId) {
    const reply = await rclient.del(
      keys.projectBlock({ project_id: projectId })
    )
    const wasBlocked = reply === 1
    return wasBlocked
  },

  _serializeRanges(ranges) {
    let jsonRanges = JSON.stringify(ranges)
    if (jsonRanges && jsonRanges.length > MAX_RANGES_SIZE) {
      throw new Error('ranges are too large')
    }
    if (jsonRanges === '{}') {
      // Most doc will have empty ranges so don't fill redis with lots of '{}' keys
      jsonRanges = null
    }
    return jsonRanges
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

  async cleanupTestRedis() {
    await RedisWrapper.cleanupTestRedis(rclient)
  },
}

module.exports = {
  rclient,
  ...callbackifyAll(RedisManager, {
    multiResult: {
      getDoc: [
        'lines',
        'version',
        'ranges',
        'pathname',
        'projectHistoryId',
        'unflushedTime',
        'lastUpdatedAt',
        'lastUpdatedBy',
        'historyRangesSupport',
        'resolvedCommentIds',
      ],
      getNextProjectToFlushAndDelete: [
        'projectId',
        'flushTimestamp',
        'queueLength',
      ],
    },
  }),
  promises: RedisManager,
}
