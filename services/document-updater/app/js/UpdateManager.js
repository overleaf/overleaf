// @ts-check

const { callbackifyAll } = require('@overleaf/promise-utils')
const ProjectLockManager = require('./ProjectLockManager')
const RedisManager = require('./RedisManager')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const RealTimeRedisManager = require('./RealTimeRedisManager')
const ShareJsUpdateManager = require('./ShareJsUpdateManager')
const HistoryManager = require('./HistoryManager')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const Errors = require('./Errors')
const DocumentManager = require('./DocumentManager')
const RangesManager = require('./RangesManager')
const SnapshotManager = require('./SnapshotManager')
const WebApiManager = require('./WebApiManager')
const Profiler = require('./Profiler')
const { isInsert, isDelete, getDocLength, computeDocHash } = require('./Utils')
const HistoryOTUpdateManager = require('./HistoryOTUpdateManager')
const { buildSparseChangePreviews } = require('./TrackedChangePreview')

/**
 * @import { Ranges, Update, HistoryUpdate } from "./types"
 */

const UpdateManager = {
  /**
   * Process the pending updates for a project under the project lock, then
   * keep going for as long as more updates are queued up.
   *
   * @param {string} projectId
   */
  async processOutstandingUpdatesWithLock(projectId) {
    const profile = new Profiler('processOutstandingUpdatesWithLock', {
      project_id: projectId,
    })

    // Always take the project lock before the per-doc lock to avoid deadlocks.
    // Wait for the project lock rather than bailing out: another action
    // holding it (e.g. for a different doc) will not process this doc's queue.
    const projectLockValue =
      await ProjectLockManager.promises.getLock(projectId)
    profile.log('getProjectLock')

    try {
      await UpdateManager.fetchAndApplyProjectUpdates(projectId, profile)
      profile.log('fetchAndApplyProjectUpdates')
    } finally {
      await ProjectLockManager.promises.releaseLock(projectId, projectLockValue)
      profile.log('releaseProjectLock').end()
    }

    await UpdateManager.continueProcessingUpdatesWithLock(projectId)
  },

  /**
   * Apply one batch of updates from the shared per-project queue. We already
   * hold the project lock, so no per-doc lock is required: the project lock
   * serialises all processing for the project. Each update carries its `doc`
   * id - real-time forces `update.doc = docId` before queueing it.
   *
   * @param {string} projectId
   * @param {Profiler} profile - profile started by the caller
   */
  async fetchAndApplyProjectUpdates(projectId, profile) {
    const updates =
      await RealTimeRedisManager.promises.getPendingProjectUpdates(projectId)
    profile.log('getPendingProjectUpdates')
    if (updates.length === 0) {
      return
    }
    for (const update of updates) {
      const docId = update.doc
      if (HistoryOTUpdateManager.isHistoryOTEditOperationUpdate(update)) {
        await HistoryOTUpdateManager.applyUpdate(projectId, docId, update)
      } else {
        await UpdateManager.applyUpdate(projectId, docId, update)
      }
      profile.log('applyProjectUpdate')
    }
  },

  /**
   * Process the project's pending updates under the project lock if any are
   * queued up.
   *
   * @param {string} projectId
   */
  async continueProcessingUpdatesWithLock(projectId) {
    const length =
      await RealTimeRedisManager.promises.getProjectUpdatesLength(projectId)
    if (length > 0) {
      await UpdateManager.processOutstandingUpdatesWithLock(projectId)
    }
  },

  /**
   * Apply an update to the given document
   *
   * @param {string} projectId
   * @param {string} docId
   * @param {Update} update
   */
  async applyUpdate(projectId, docId, update) {
    const profile = new Profiler('applyUpdate', {
      project_id: projectId,
      doc_id: docId,
    })

    UpdateManager._sanitizeUpdate(update)
    profile.log('sanitizeUpdate', { sync: true })

    try {
      let {
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        historyRangesSupport,
        type,
      } = await DocumentManager.promises.getDoc(projectId, docId)
      profile.log('getDoc')

      if (lines == null || version == null) {
        throw new Errors.NotFoundError(`document not found: ${docId}`)
      }
      if (type !== 'sharejs-text-ot') {
        throw new Errors.OTTypeMismatchError(type, 'sharejs-text-ot')
      }

      const previousVersion = version
      const incomingUpdateVersion = update.v
      let updatedDocLines, appliedOps
      ;({ updatedDocLines, version, appliedOps } =
        await ShareJsUpdateManager.promises.applyUpdate(
          projectId,
          docId,
          update,
          lines,
          version
        ))
      profile.log('sharejs.applyUpdate', {
        // only synchronous when the update applies directly to the
        // doc version, otherwise getPreviousDocOps is called.
        sync: incomingUpdateVersion === previousVersion,
      })

      const {
        newRanges,
        rangesWereCollapsed,
        historyUpdates,
        removedChangeIds,
      } = RangesManager.applyUpdate(
        projectId,
        docId,
        ranges,
        appliedOps,
        updatedDocLines,
        { historyRangesSupport }
      )
      profile.log('RangesManager.applyUpdate', { sync: true })

      await RedisManager.promises.updateDocument(
        projectId,
        docId,
        updatedDocLines,
        version,
        appliedOps,
        newRanges,
        update.meta
      )
      profile.log('RedisManager.updateDocument')

      UpdateManager._adjustHistoryUpdatesMetadata(
        historyUpdates,
        pathname,
        projectHistoryId,
        lines,
        ranges,
        updatedDocLines,
        historyRangesSupport
      )

      if (historyUpdates.length > 0) {
        Metrics.inc('history-queue', 1, { status: 'project-history' })
        try {
          const projectOpsLength =
            await ProjectHistoryRedisManager.promises.queueOps(
              projectId,
              ...historyUpdates.map(op => JSON.stringify(op))
            )
          HistoryManager.recordAndFlushHistoryOps(
            projectId,
            historyUpdates,
            projectOpsLength
          )
          profile.log('recordAndFlushHistoryOps')
        } catch (err) {
          // The full project history can re-sync a project in case
          //  updates went missing.
          // Just record the error here and acknowledge the write-op.
          Metrics.inc('history-queue-error')
        }
        const timestamp = update.meta?.ts || Date.now()
        await RedisManager.promises.recordProjectNotificationTimestamp(
          projectId,
          timestamp
        )
        profile.log('recordProjectNotificationTimestamp')
      }

      // applyUpdate is not triggered by accept change operations, so any
      // tracked change removed by the ops we just applied was rejected.
      // Look up the authors of those rejected changes from the pre-update
      // ranges so we can notify web below.
      if (removedChangeIds.length > 0) {
        const rejectedChanges = (ranges?.changes || []).filter(change =>
          removedChangeIds.includes(change.id)
        )
        const rejectedChangeAuthorIds = rejectedChanges.map(
          change => change.metadata.user_id
        )
        const previews = buildSparseChangePreviews({
          changes: rejectedChanges,
          lines,
        })

        // Fire-and-forget without awaiting because
        // we hold the project lock here, and the result of the
        // notification doesn't affect the update
        WebApiManager.promises
          .notifyTrackChangesRejected(
            projectId,
            docId,
            rejectedChangeAuthorIds,
            update.meta?.user_id,
            previews
          )
          .catch(err => {
            logger.warn(
              { err, projectId, docId, rejectedChangeAuthorIds },
              'failed to notify web of rejected track changes'
            )
          })
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
        // If it overruns the project lock, it's ok, since all of our redis work is done
        await SnapshotManager.promises.recordSnapshot(
          projectId,
          docId,
          previousVersion,
          pathname,
          lines,
          ranges
        )
      }
    } catch (error) {
      RealTimeRedisManager.sendData({
        project_id: projectId,
        doc_id: docId,
        error: error instanceof Error ? error.message : String(error),
      })
      profile.log('sendData')
      throw error
    } finally {
      profile.end()
    }
  },

  /**
   * Process the project's pending updates, then run the given method on the
   * doc, all under the project lock.
   *
   * @param {Function} method - called with (projectId, docId, ...args)
   * @param {string} projectId
   * @param {string} docId
   * @param {...any} args
   * @return {Promise<any>} the return value of `method`
   */
  async lockUpdatesAndDo(method, projectId, docId, ...args) {
    const profile = new Profiler('lockUpdatesAndDo', {
      project_id: projectId,
      doc_id: docId,
    })

    // Take the project lock so we can safely drain the shared per-project queue
    // and then run the operation itself.
    const projectLockValue =
      await ProjectLockManager.promises.getLock(projectId)
    profile.log('getProjectLock')

    let result
    try {
      await UpdateManager.fetchAndApplyProjectUpdates(projectId, profile)
      profile.log('fetchAndApplyProjectUpdates')

      await ProjectLockManager.promises.extendLock(projectId, projectLockValue)
      profile.log('extendProjectLock')

      result = await method(projectId, docId, ...args)
      profile.log('method')
    } finally {
      await ProjectLockManager.promises.releaseLock(projectId, projectLockValue)
      profile.log('releaseProjectLock').end()
    }

    // We held the lock for a while so updates might have queued up
    UpdateManager.continueProcessingUpdatesWithLock(projectId).catch(err => {
      // The processing may fail for invalid user updates.
      // This can be very noisy, put them on level DEBUG
      //  and record a metric.
      Metrics.inc('background-processing-updates-error')
      logger.debug(
        { err, projectId, docId },
        'error processing updates in background'
      )
    })

    return result
  },

  /**
   * Replace unpaired surrogate characters in the update's inserts.
   *
   * @param {Update} update
   * @return {Update}
   */
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
    for (const op of update.op || []) {
      if (isInsert(op)) {
        // Replace high and low surrogate characters with 'replacement character' (\uFFFD)
        op.i = op.i.replace(/[\uD800-\uDFFF]/g, '\uFFFD')
      }
    }
    return update
  },

  /**
   * Add metadata that will be useful to project history
   *
   * @param {HistoryUpdate[]} updates
   * @param {string} pathname
   * @param {string} projectHistoryId
   * @param {string[]} lines - document lines before updates were applied
   * @param {Ranges} ranges - ranges before updates were applied
   * @param {string[]} newLines - document lines after updates were applied
   * @param {boolean} historyRangesSupport
   */
  _adjustHistoryUpdatesMetadata(
    updates,
    pathname,
    projectHistoryId,
    lines,
    ranges,
    newLines,
    historyRangesSupport
  ) {
    let docLength = getDocLength(lines)
    let historyDocLength = docLength
    for (const change of ranges.changes ?? []) {
      if ('d' in change.op) {
        historyDocLength += change.op.d.length
      }
    }

    for (const update of updates) {
      update.projectHistoryId = projectHistoryId
      if (!update.meta) {
        update.meta = {}
      }
      update.meta.pathname = pathname
      update.meta.doc_length = docLength
      if (historyRangesSupport && historyDocLength !== docLength) {
        update.meta.history_doc_length = historyDocLength
      }

      // Each update may contain multiple ops, i.e.
      // [{
      // 	ops: [{i: "foo", p: 4}, {d: "bar", p:8}]
      // }, {
      // 	ops: [{d: "baz", p: 40}, {i: "qux", p:8}]
      // }]
      // We want to include the doc_length at the start of each update,
      // before it's ops are applied. However, we need to track any
      // changes to it for the next update.
      for (const op of update.op) {
        if (isInsert(op)) {
          docLength += op.i.length
          if (!op.trackedDeleteRejection) {
            // Tracked delete rejections end up retaining characters rather
            // than inserting
            historyDocLength += op.i.length
          }
        }
        if (isDelete(op)) {
          docLength -= op.d.length
          if (update.meta.tc) {
            // This is a tracked delete. It will be translated into a retain in
            // history, except any enclosed tracked inserts, which will be
            // translated into regular deletes.
            for (const change of op.trackedChanges ?? []) {
              if (change.type === 'insert') {
                historyDocLength -= change.length
              }
            }
          } else {
            // This is a regular delete.  It will be translated to a delete in
            // history.
            historyDocLength -= op.d.length
          }
        }
      }

      if (!historyRangesSupport) {
        // Prevent project-history from processing tracked changes
        delete update.meta.tc
      }
    }

    if (historyRangesSupport && updates.length > 0) {
      const lastUpdate = updates[updates.length - 1]
      lastUpdate.meta ??= {}
      lastUpdate.meta.doc_hash = computeDocHash(newLines)
    }
  },
}

module.exports = { ...callbackifyAll(UpdateManager), promises: UpdateManager }
