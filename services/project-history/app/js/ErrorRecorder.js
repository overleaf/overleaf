// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { promisify } from 'util'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import { db } from './mongodb.js'

export function record(projectId, queueSize, error, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const _callback = function (mongoError) {
    if (mongoError != null) {
      logger.error(
        { projectId, mongoError },
        'failed to change project statues in mongo'
      )
    }
    return callback(error || null, queueSize)
  }

  if (error != null) {
    const errorRecord = {
      queueSize,
      error: error.toString(),
      stack: error.stack,
      ts: new Date(),
    }
    logger.debug(
      { projectId, errorRecord },
      'recording failed attempt to process updates'
    )
    return db.projectHistoryFailures.updateOne(
      {
        project_id: projectId,
      },
      {
        $set: errorRecord,
        $inc: {
          attempts: 1,
        },
        $push: {
          history: {
            $each: [errorRecord],
            $position: 0,
            $slice: 10,
          },
        }, // only keep recent failures
      },
      {
        upsert: true,
      },
      _callback
    )
  } else {
    return db.projectHistoryFailures.deleteOne(
      { project_id: projectId },
      _callback
    )
  }
}

export function setForceDebug(projectId, state, callback) {
  if (state == null) {
    state = true
  }
  if (callback == null) {
    callback = function () {}
  }
  logger.debug({ projectId, state }, 'setting forceDebug state for project')
  return db.projectHistoryFailures.updateOne(
    { project_id: projectId },
    { $set: { forceDebug: state } },
    { upsert: true },
    callback
  )
}

// we only record the sync start time, and not the end time, because the
// record should be cleared on success.
export function recordSyncStart(projectId, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return db.projectHistoryFailures.updateOne(
    {
      project_id: projectId,
    },
    {
      $currentDate: {
        resyncStartedAt: true,
      },
      $inc: {
        resyncAttempts: 1,
      },
      $push: {
        history: {
          $each: [{ resyncStartedAt: new Date() }],
          $position: 0,
          $slice: 10,
        },
      },
    },
    {
      upsert: true,
    },
    callback
  )
}

export function getFailureRecord(projectId, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return db.projectHistoryFailures.findOne({ project_id: projectId }, callback)
}

export function getLastFailure(projectId, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return db.projectHistoryFailures.findOneAndUpdate(
    { project_id: projectId },
    { $inc: { requestCount: 1 } }, // increment the request count every time we check the last failure
    { projection: { error: 1, ts: 1 } },
    (err, result) => callback(err, result && result.value)
  )
}

export function getFailedProjects(callback) {
  if (callback == null) {
    callback = function () {}
  }
  return db.projectHistoryFailures.find({}).toArray(function (error, results) {
    if (error != null) {
      return callback(OError.tag(error))
    }
    return callback(null, results)
  })
}

export function getFailuresByType(callback) {
  if (callback == null) {
    callback = function () {}
  }
  db.projectHistoryFailures.find({}).toArray(function (error, results) {
    if (error != null) {
      return callback(OError.tag(error))
    }
    const failureCounts = {}
    const failureAttempts = {}
    const failureRequests = {}
    const maxQueueSize = {}
    // count all the failures and number of attempts by type
    for (const result of Array.from(results || [])) {
      const failureType = result.error
      const attempts = result.attempts || 1 // allow for field to be absent
      const requests = result.requestCount || 0
      const queueSize = result.queueSize || 0
      if (failureCounts[failureType] > 0) {
        failureCounts[failureType]++
        failureAttempts[failureType] += attempts
        failureRequests[failureType] += requests
        maxQueueSize[failureType] = Math.max(
          queueSize,
          maxQueueSize[failureType]
        )
      } else {
        failureCounts[failureType] = 1
        failureAttempts[failureType] = attempts
        failureRequests[failureType] = requests
        maxQueueSize[failureType] = queueSize
      }
    }
    return callback(
      null,
      failureCounts,
      failureAttempts,
      failureRequests,
      maxQueueSize
    )
  })
}

export function getFailures(callback) {
  if (callback == null) {
    callback = function () {}
  }
  return getFailuresByType(function (
    error,
    failureCounts,
    failureAttempts,
    failureRequests,
    maxQueueSize
  ) {
    let attempts, failureType, label, requests
    if (error != null) {
      return callback(OError.tag(error))
    }

    const shortNames = {
      'Error: bad response from filestore: 404': 'filestore-404',
      'Error: bad response from filestore: 500': 'filestore-500',
      'NotFoundError: got a 404 from web api': 'web-api-404',
      'Error: history store a non-success status code: 413':
        'history-store-413',
      'Error: history store a non-success status code: 422':
        'history-store-422',
      'Error: history store a non-success status code: 500':
        'history-store-500',
      'Error: history store a non-success status code: 503':
        'history-store-503',
      'Error: web returned a non-success status code: 500 (attempts: 2)':
        'web-500',
      'Error: ESOCKETTIMEDOUT': 'socket-timeout',
      'Error: no project found': 'no-project-found',
      'OpsOutOfOrderError: project structure version out of order on incoming updates':
        'incoming-project-version-out-of-order',
      'OpsOutOfOrderError: doc version out of order on incoming updates':
        'incoming-doc-version-out-of-order',
      'OpsOutOfOrderError: project structure version out of order':
        'chunk-project-version-out-of-order',
      'OpsOutOfOrderError: doc version out of order':
        'chunk-doc-version-out-of-order',
      'Error: failed to extend lock': 'lock-overrun',
      'Error: tried to release timed out lock': 'lock-overrun',
      'Error: Timeout': 'lock-overrun',
      'Error: sync ongoing': 'sync-ongoing',
      'SyncError: unexpected resyncProjectStructure update': 'sync-error',
      '[object Error]': 'unknown-error-object',
      'UpdateWithUnknownFormatError: update with unknown format':
        'unknown-format',
      'Error: update with unknown format': 'unknown-format',
      'TextOperationError: The base length of the second operation has to be the target length of the first operation':
        'text-op-error',
      'Error: ENOSPC: no space left on device, write': 'ENOSPC',
      '*': 'other',
    }

    // set all the known errors to zero if not present (otherwise gauges stay on their last value)
    const summaryCounts = {}
    const summaryAttempts = {}
    const summaryRequests = {}
    const summaryMaxQueueSize = {}

    for (failureType in shortNames) {
      label = shortNames[failureType]
      summaryCounts[label] = 0
      summaryAttempts[label] = 0
      summaryRequests[label] = 0
      summaryMaxQueueSize[label] = 0
    }

    // record a metric for each type of failure
    for (failureType in failureCounts) {
      const failureCount = failureCounts[failureType]
      label = shortNames[failureType] || shortNames['*']
      summaryCounts[label] += failureCount
      summaryAttempts[label] += failureAttempts[failureType]
      summaryRequests[label] += failureRequests[failureType]
      summaryMaxQueueSize[label] = Math.max(
        maxQueueSize[failureType],
        summaryMaxQueueSize[label]
      )
    }

    for (label in summaryCounts) {
      const count = summaryCounts[label]
      metrics.globalGauge('failed', count, 1, { status: label })
    }

    for (label in summaryAttempts) {
      attempts = summaryAttempts[label]
      metrics.globalGauge('attempts', attempts, 1, { status: label })
    }

    for (label in summaryRequests) {
      requests = summaryRequests[label]
      metrics.globalGauge('requests', requests, 1, { status: label })
    }

    for (label in summaryMaxQueueSize) {
      const queueSize = summaryMaxQueueSize[label]
      metrics.globalGauge('max-queue-size', queueSize, 1, { status: label })
    }

    return callback(null, {
      counts: summaryCounts,
      attempts: summaryAttempts,
      requests: summaryRequests,
      maxQueueSize: summaryMaxQueueSize,
    })
  })
}

export const promises = {
  getFailedProjects: promisify(getFailedProjects),
  record: promisify(record),
  getFailureRecord: promisify(getFailureRecord),
}
