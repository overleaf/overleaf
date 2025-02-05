import { promisify } from 'node:util'
import logger from '@overleaf/logger'
import async from 'async'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import OError from '@overleaf/o-error'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as UpdateTranslator from './UpdateTranslator.js'
import * as BlobManager from './BlobManager.js'
import * as RedisManager from './RedisManager.js'
import * as ErrorRecorder from './ErrorRecorder.js'
import * as LockManager from './LockManager.js'
import * as UpdateCompressor from './UpdateCompressor.js'
import * as WebApiManager from './WebApiManager.js'
import * as SyncManager from './SyncManager.js'
import * as Versions from './Versions.js'
import * as Errors from './Errors.js'
import * as Metrics from './Metrics.js'
import { Profiler } from './Profiler.js'

const keys = Settings.redis.lock.key_schema

export const REDIS_READ_BATCH_SIZE = 500

/**
 * Container for functions that need to be mocked in tests
 *
 * TODO: Rewrite tests in terms of exported functions only
 */
export const _mocks = {}

export function getRawUpdates(projectId, batchSize, callback) {
  RedisManager.getRawUpdatesBatch(projectId, batchSize, (error, batch) => {
    if (error != null) {
      return callback(OError.tag(error))
    }

    let updates
    try {
      updates = RedisManager.parseDocUpdates(batch.rawUpdates)
    } catch (error) {
      return callback(OError.tag(error))
    }

    _getHistoryId(projectId, updates, (error, historyId) => {
      if (error != null) {
        return callback(OError.tag(error))
      }
      HistoryStoreManager.getMostRecentChunk(
        projectId,
        historyId,
        (error, chunk) => {
          if (error != null) {
            return callback(OError.tag(error))
          }
          callback(null, { project_id: projectId, chunk, updates })
        }
      )
    })
  })
}

// Trigger resync and start processing under lock to avoid other operations to
// flush the resync updates.
export function startResyncAndProcessUpdatesUnderLock(
  projectId,
  opts,
  callback
) {
  const startTimeMs = Date.now()
  LockManager.runWithLock(
    keys.projectHistoryLock({ project_id: projectId }),
    (extendLock, releaseLock) => {
      SyncManager.startResyncWithoutLock(projectId, opts, err => {
        if (err) return callback(OError.tag(err))
        extendLock(err => {
          if (err) return callback(OError.tag(err))
          _countAndProcessUpdates(
            projectId,
            extendLock,
            REDIS_READ_BATCH_SIZE,
            releaseLock
          )
        })
      })
    },
    (error, queueSize) => {
      if (error) {
        OError.tag(error)
      }
      ErrorRecorder.record(projectId, queueSize, error, callback)
      if (queueSize > 0) {
        const duration = (Date.now() - startTimeMs) / 1000
        Metrics.historyFlushDurationSeconds.observe(duration)
        Metrics.historyFlushQueueSize.observe(queueSize)
      }
      // clear the timestamp in the background if the queue is now empty
      RedisManager.clearDanglingFirstOpTimestamp(projectId, () => {})
    }
  )
}

// Process all updates for a project, only check project-level information once
export function processUpdatesForProject(projectId, callback) {
  const startTimeMs = Date.now()
  LockManager.runWithLock(
    keys.projectHistoryLock({ project_id: projectId }),
    (extendLock, releaseLock) => {
      _countAndProcessUpdates(
        projectId,
        extendLock,
        REDIS_READ_BATCH_SIZE,
        releaseLock
      )
    },
    (error, queueSize) => {
      if (error) {
        OError.tag(error)
      }
      ErrorRecorder.record(projectId, queueSize, error, callback)
      if (queueSize > 0) {
        const duration = (Date.now() - startTimeMs) / 1000
        Metrics.historyFlushDurationSeconds.observe(duration)
        Metrics.historyFlushQueueSize.observe(queueSize)
      }
      // clear the timestamp in the background if the queue is now empty
      RedisManager.clearDanglingFirstOpTimestamp(projectId, () => {})
    }
  )
}

export function processUpdatesForProjectUsingBisect(
  projectId,
  amountToProcess,
  callback
) {
  LockManager.runWithLock(
    keys.projectHistoryLock({ project_id: projectId }),
    (extendLock, releaseLock) => {
      _countAndProcessUpdates(
        projectId,
        extendLock,
        amountToProcess,
        releaseLock
      )
    },
    (error, queueSize) => {
      if (amountToProcess === 0 || queueSize === 0) {
        // no further processing possible
        if (error != null) {
          ErrorRecorder.record(
            projectId,
            queueSize,
            OError.tag(error),
            callback
          )
        } else {
          callback()
        }
      } else {
        if (error != null) {
          // decrease the batch size when we hit an error
          processUpdatesForProjectUsingBisect(
            projectId,
            Math.floor(amountToProcess / 2),
            callback
          )
        } else {
          // otherwise continue processing with the same batch size
          processUpdatesForProjectUsingBisect(
            projectId,
            amountToProcess,
            callback
          )
        }
      }
    }
  )
}

export function processSingleUpdateForProject(projectId, callback) {
  LockManager.runWithLock(
    keys.projectHistoryLock({ project_id: projectId }),
    (
      extendLock,
      releaseLock // set the batch size to 1 for single-stepping
    ) => {
      _countAndProcessUpdates(projectId, extendLock, 1, releaseLock)
    },
    (
      error,
      queueSize // no need to clear the flush marker when single stepping
    ) => {
      // it will be cleared up on the next background flush if
      // the queue is empty
      ErrorRecorder.record(projectId, queueSize, error, callback)
    }
  )
}

_mocks._countAndProcessUpdates = (
  projectId,
  extendLock,
  batchSize,
  callback
) => {
  RedisManager.countUnprocessedUpdates(projectId, (error, queueSize) => {
    if (error != null) {
      return callback(OError.tag(error))
    }
    if (queueSize > 0) {
      logger.debug({ projectId, queueSize }, 'processing uncompressed updates')
      RedisManager.getUpdatesInBatches(
        projectId,
        batchSize,
        (updates, cb) => {
          _processUpdatesBatch(projectId, updates, extendLock, cb)
        },
        error => {
          // Unconventional callback signature. The caller needs the queue size
          // even when an error is thrown in order to record the queue size in
          // the projectHistoryFailures collection. We'll have to find another
          // way to achieve this when we promisify.
          callback(error, queueSize)
        }
      )
    } else {
      logger.debug({ projectId }, 'no updates to process')
      callback(null, queueSize)
    }
  })
}

function _countAndProcessUpdates(...args) {
  _mocks._countAndProcessUpdates(...args)
}

function _processUpdatesBatch(projectId, updates, extendLock, callback) {
  // If the project doesn't have a history then we can bail out here
  _getHistoryId(projectId, updates, (error, historyId) => {
    if (error != null) {
      return callback(OError.tag(error))
    }

    if (historyId == null) {
      logger.debug(
        { projectId },
        'discarding updates as project does not use history'
      )
      return callback()
    }

    _processUpdates(projectId, historyId, updates, extendLock, error => {
      if (error != null) {
        return callback(OError.tag(error))
      }
      callback()
    })
  })
}

export function _getHistoryId(projectId, updates, callback) {
  let idFromUpdates = null

  // check that all updates have the same history id
  for (const update of updates) {
    if (update.projectHistoryId != null) {
      if (idFromUpdates == null) {
        idFromUpdates = update.projectHistoryId.toString()
      } else if (idFromUpdates !== update.projectHistoryId.toString()) {
        metrics.inc('updates.batches.project-history-id.inconsistent-update')
        return callback(
          new OError('inconsistent project history id between updates', {
            projectId,
            idFromUpdates,
            currentId: update.projectHistoryId,
          })
        )
      }
    }
  }

  WebApiManager.getHistoryId(projectId, (error, idFromWeb) => {
    if (error != null && idFromUpdates != null) {
      // present only on updates
      // 404s from web are an error
      metrics.inc('updates.batches.project-history-id.from-updates')
      return callback(null, idFromUpdates)
    } else if (error != null) {
      return callback(OError.tag(error))
    }

    if (idFromWeb == null && idFromUpdates == null) {
      // present on neither web nor updates
      callback(null, null)
    } else if (idFromWeb != null && idFromUpdates == null) {
      // present only on web
      metrics.inc('updates.batches.project-history-id.from-web')
      callback(null, idFromWeb)
    } else if (idFromWeb == null && idFromUpdates != null) {
      // present only on updates
      metrics.inc('updates.batches.project-history-id.from-updates')
      callback(null, idFromUpdates)
    } else if (idFromWeb.toString() !== idFromUpdates.toString()) {
      // inconsistent between web and updates
      metrics.inc('updates.batches.project-history-id.inconsistent-with-web')
      logger.warn(
        {
          projectId,
          idFromWeb,
          idFromUpdates,
          updates,
        },
        'inconsistent project history id between updates and web'
      )
      callback(
        new OError('inconsistent project history id between updates and web')
      )
    } else {
      // the same on web and updates
      metrics.inc('updates.batches.project-history-id.from-updates')
      callback(null, idFromWeb)
    }
  })
}

function _handleOpsOutOfOrderError(projectId, projectHistoryId, err, ...rest) {
  const adjustedLength = Math.max(rest.length, 1)
  const results = rest.slice(0, adjustedLength - 1)
  const callback = rest[adjustedLength - 1]
  ErrorRecorder.getFailureRecord(projectId, (error, failureRecord) => {
    if (error != null) {
      return callback(error)
    }
    // Bypass ops-out-of-order errors in the stored chunk when in forceDebug mode
    if (failureRecord != null && failureRecord.forceDebug === true) {
      logger.warn(
        { err, projectId, projectHistoryId },
        'ops out of order in chunk, forced continue'
      )
      callback(null, ...results) // return results without error
    } else {
      callback(err, ...results)
    }
  })
}

function _getMostRecentVersionWithDebug(projectId, projectHistoryId, callback) {
  HistoryStoreManager.getMostRecentVersion(
    projectId,
    projectHistoryId,
    (err, ...results) => {
      if (err instanceof Errors.OpsOutOfOrderError) {
        _handleOpsOutOfOrderError(
          projectId,
          projectHistoryId,
          err,
          ...results,
          callback
        )
      } else {
        callback(err, ...results)
      }
    }
  )
}

export function _processUpdates(
  projectId,
  projectHistoryId,
  updates,
  extendLock,
  callback
) {
  const profile = new Profiler('_processUpdates', {
    project_id: projectId,
    projectHistoryId,
  })
  // skip updates first if we're in a sync, we might not need to do anything else
  SyncManager.skipUpdatesDuringSync(
    projectId,
    updates,
    (error, filteredUpdates, newSyncState) => {
      profile.log('skipUpdatesDuringSync')
      if (error != null) {
        return callback(error)
      }
      if (filteredUpdates.length === 0) {
        // return early if there are no updates to apply
        return SyncManager.setResyncState(projectId, newSyncState, callback)
      }
      // only make request to history service if we have actual updates to process
      _getMostRecentVersionWithDebug(
        projectId,
        projectHistoryId,
        (
          error,
          baseVersion,
          projectStructureAndDocVersions,
          _lastChange,
          mostRecentChunk
        ) => {
          if (projectStructureAndDocVersions == null) {
            projectStructureAndDocVersions = { project: null, docs: {} }
          }
          profile.log('getMostRecentVersion')
          if (error != null) {
            return callback(error)
          }
          async.waterfall(
            [
              cb => {
                cb = profile.wrap('expandSyncUpdates', cb)
                SyncManager.expandSyncUpdates(
                  projectId,
                  projectHistoryId,
                  mostRecentChunk,
                  filteredUpdates,
                  extendLock,
                  cb
                )
              },
              (expandedUpdates, cb) => {
                let unappliedUpdates
                try {
                  unappliedUpdates = _skipAlreadyAppliedUpdates(
                    projectId,
                    expandedUpdates,
                    projectStructureAndDocVersions
                  )
                } catch (err) {
                  return cb(err)
                }
                profile.log('skipAlreadyAppliedUpdates')
                const compressedUpdates =
                  UpdateCompressor.compressRawUpdates(unappliedUpdates)
                const timeTaken = profile
                  .log('compressRawUpdates')
                  .getTimeDelta()
                if (timeTaken >= 1000) {
                  logger.debug(
                    { projectId, updates: unappliedUpdates, timeTaken },
                    'slow compression of raw updates'
                  )
                }
                cb = profile.wrap('createBlobs', cb)
                BlobManager.createBlobsForUpdates(
                  projectId,
                  projectHistoryId,
                  compressedUpdates,
                  extendLock,
                  cb
                )
              },
              (updatesWithBlobs, cb) => {
                let changes
                try {
                  changes = UpdateTranslator.convertToChanges(
                    projectId,
                    updatesWithBlobs
                  ).map(change => change.toRaw())
                } catch (err) {
                  return cb(err)
                } finally {
                  profile.log('convertToChanges')
                }
                cb(null, changes)
              },
              (changes, cb) => {
                let change
                const numChanges = changes.length
                const byteLength = Buffer.byteLength(
                  JSON.stringify(changes),
                  'utf8'
                )
                let numOperations = 0
                for (change of changes) {
                  if (change.operations != null) {
                    numOperations += change.operations.length
                  }
                }

                metrics.timing('history-store.request.changes', numChanges, 1)
                metrics.timing('history-store.request.bytes', byteLength, 1)
                metrics.timing(
                  'history-store.request.operations',
                  numOperations,
                  1
                )

                // thresholds taken from write_latex/main/lib/history_exporter.rb
                if (numChanges > 1000) {
                  metrics.inc('history-store.request.exceeds-threshold.changes')
                }
                if (byteLength > Math.pow(1024, 2)) {
                  metrics.inc('history-store.request.exceeds-threshold.bytes')
                  const changeLengths = changes.map(change =>
                    Buffer.byteLength(JSON.stringify(change), 'utf8')
                  )
                  logger.warn(
                    { projectId, byteLength, changeLengths },
                    'change size exceeds limit'
                  )
                }

                cb = profile.wrap('sendChanges', cb)
                // this is usually the longest request, so extend the lock before starting it
                extendLock(error => {
                  if (error != null) {
                    return cb(error)
                  }
                  if (changes.length === 0) {
                    return cb()
                  } // avoid unnecessary requests to history service
                  HistoryStoreManager.sendChanges(
                    projectId,
                    projectHistoryId,
                    changes,
                    baseVersion,
                    cb
                  )
                })
              },
              cb => {
                cb = profile.wrap('setResyncState', cb)
                SyncManager.setResyncState(projectId, newSyncState, cb)
              },
            ],
            error => {
              profile.end()
              callback(error)
            }
          )
        }
      )
    }
  )
}

_mocks._skipAlreadyAppliedUpdates = (
  projectId,
  updates,
  projectStructureAndDocVersions
) => {
  function alreadySeenProjectVersion(previousProjectStructureVersion, update) {
    return (
      UpdateTranslator.isProjectStructureUpdate(update) &&
      previousProjectStructureVersion != null &&
      update.version != null &&
      Versions.gte(previousProjectStructureVersion, update.version)
    )
  }

  function alreadySeenDocVersion(previousDocVersions, update) {
    if (UpdateTranslator.isTextUpdate(update) && update.v != null) {
      const docId = update.doc
      return (
        previousDocVersions[docId] != null &&
        previousDocVersions[docId].v != null &&
        Versions.gte(previousDocVersions[docId].v, update.v)
      )
    } else {
      return false
    }
  }

  // check that the incoming updates are in the correct order (we do not
  // want to send out of order updates to the history service)
  let incomingProjectStructureVersion = null
  const incomingDocVersions = {}
  for (const update of updates) {
    if (alreadySeenProjectVersion(incomingProjectStructureVersion, update)) {
      logger.warn(
        { projectId, update, incomingProjectStructureVersion },
        'incoming project structure updates are out of order'
      )
      throw new Errors.OpsOutOfOrderError(
        'project structure version out of order on incoming updates'
      )
    } else if (alreadySeenDocVersion(incomingDocVersions, update)) {
      logger.warn(
        { projectId, update, incomingDocVersions },
        'incoming doc updates are out of order'
      )
      throw new Errors.OpsOutOfOrderError(
        'doc version out of order on incoming updates'
      )
    }
    // update the current project structure and doc versions
    if (UpdateTranslator.isProjectStructureUpdate(update)) {
      incomingProjectStructureVersion = update.version
    } else if (UpdateTranslator.isTextUpdate(update)) {
      incomingDocVersions[update.doc] = { v: update.v }
    }
  }

  // discard updates already applied
  const updatesToApply = []
  const previousProjectStructureVersion = projectStructureAndDocVersions.project
  const previousDocVersions = projectStructureAndDocVersions.docs
  if (projectStructureAndDocVersions != null) {
    const updateProjectVersions = []
    for (const update of updates) {
      if (update != null && update.version != null) {
        updateProjectVersions.push(update.version)
      }
    }
    logger.debug(
      { projectId, projectStructureAndDocVersions, updateProjectVersions },
      'comparing updates with existing project versions'
    )
  }
  for (const update of updates) {
    if (alreadySeenProjectVersion(previousProjectStructureVersion, update)) {
      metrics.inc('updates.discarded_project_structure_version')
      logger.debug(
        { projectId, update, previousProjectStructureVersion },
        'discarding previously applied project structure update'
      )
      continue
    }
    if (alreadySeenDocVersion(previousDocVersions, update)) {
      metrics.inc('updates.discarded_doc_version')
      logger.debug(
        { projectId, update, previousDocVersions },
        'discarding previously applied doc update'
      )
      continue
    }
    // remove non-BMP characters from resync updates that have bypassed the normal docupdater flow
    _sanitizeUpdate(update)
    // if all checks above are ok then accept the update
    updatesToApply.push(update)
  }

  return updatesToApply
}

export function _skipAlreadyAppliedUpdates(...args) {
  return _mocks._skipAlreadyAppliedUpdates(...args)
}

function _sanitizeUpdate(update) {
  // adapted from docupdater's UpdateManager, we should clean these in docupdater
  // too but we already have queues with this problem so we will handle it here
  // too for robustness.
  // Replace high and low surrogate characters with 'replacement character' (\uFFFD)
  const removeBadChars = str => str.replace(/[\uD800-\uDFFF]/g, '\uFFFD')
  // clean up any bad chars in resync diffs
  if (update.op) {
    for (const op of update.op) {
      if (op.i != null) {
        op.i = removeBadChars(op.i)
      }
    }
  }
  // clean up any bad chars in resync new docs
  if (update.docLines != null) {
    update.docLines = removeBadChars(update.docLines)
  }
  return update
}

export const promises = {
  /** @type {(projectId: string) => Promise<number>} */
  processUpdatesForProject: promisify(processUpdatesForProject),
  /** @type {(projectId: string, opts: any) => Promise<number>} */
  startResyncAndProcessUpdatesUnderLock: promisify(
    startResyncAndProcessUpdatesUnderLock
  ),
}
