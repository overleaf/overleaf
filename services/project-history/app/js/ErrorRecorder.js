// @ts-check

import { callbackify } from 'node:util'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import { db } from './mongodb.js'

/**
 * @import { ProjectHistoryFailure } from './mongo-types'
 */

/**
 * @template {{error: string}|{}} T
 * @param {T} failure
 * @return {T}
 */
function normalizeFailure(failure) {
  if ('error' in failure && failure.error?.includes('OError:')) {
    return {
      ...failure,
      error: failure.error.replace('OError:', 'Error:'),
    }
  }
  return failure
}

/**
 * @param {string} projectId
 * @param {number} queueSize
 * @param {Error} error
 * @return {Promise<ProjectHistoryFailure>} the failure record
 */
async function record(projectId, queueSize, error) {
  const errorRecord = {
    queueSize,
    error: error.toString(),
    stack: error.stack ?? '',
    ts: new Date(),
  }
  logger.debug(
    { projectId, errorRecord },
    'recording failed attempt to process updates'
  )
  const result = await db.projectHistoryFailures.findOneAndUpdate(
    { project_id: projectId },
    {
      $set: errorRecord,
      $inc: { attempts: 1 },
      $push: {
        history: {
          $each: [errorRecord],
          $position: 0,
          // only keep recent failures
          $slice: 10,
        },
      },
    },
    { upsert: true, returnDocument: 'after', includeResultMetadata: true }
  )
  if (result.value == null) {
    // Since we upsert, the result should always have a value
    throw new OError('no value returned when recording an error', { projectId })
  }
  return normalizeFailure(result.value)
}

async function clearError(projectId) {
  await db.projectHistoryFailures.deleteOne({ project_id: projectId })
}

async function setForceDebug(projectId, state) {
  if (state == null) {
    state = true
  }
  logger.debug({ projectId, state }, 'setting forceDebug state for project')
  await db.projectHistoryFailures.updateOne(
    { project_id: projectId },
    { $set: { forceDebug: state } },
    { upsert: true }
  )
}

// we only record the sync start time, and not the end time, because the
// record should be cleared on success.
async function recordSyncStart(projectId) {
  await db.projectHistoryFailures.updateOne(
    { project_id: projectId },
    {
      $currentDate: { resyncStartedAt: true },
      $inc: { resyncAttempts: 1 },
      $push: {
        history: {
          $each: [{ resyncStartedAt: new Date() }],
          $position: 0,
          $slice: 10,
        },
      },
    },
    { upsert: true }
  )
}

/**
 * @param {string} sourceProjectId
 * @param {string} targetProjectId
 * @return {Promise<void>}
 */
async function cloneFailure(sourceProjectId, targetProjectId) {
  const failure = await db.projectHistoryFailures.findOne(
    { project_id: sourceProjectId.toString() },
    { projection: { _id: 0, project_id: 0 } }
  )
  if (!failure) return
  await db.projectHistoryFailures.insertOne({
    ...failure,
    project_id: targetProjectId.toString(),
  })
}

/**
 * @param projectId
 */
async function getFailureRecord(projectId) {
  const result = await db.projectHistoryFailures.findOne({
    project_id: projectId,
  })
  return result && normalizeFailure(result)
}

async function getLastFailure(projectId) {
  const result = await db.projectHistoryFailures.findOneAndUpdate(
    { project_id: projectId },
    { $inc: { requestCount: 1 } }, // increment the request count every time we check the last failure
    { projection: { error: 1, ts: 1 } }
  )
  return result?.value && normalizeFailure(result.value)
}

async function getFailedProjects() {
  return await db.projectHistoryFailures
    .find({})
    .map(normalizeFailure)
    .toArray()
}

async function getFailuresByType() {
  const results = await getFailedProjects()
  const failureCounts = {}
  const failureAttempts = {}
  const failureRequests = {}
  const maxQueueSize = {}
  // count all the failures and number of attempts by type
  for (const result of results || []) {
    const failureType = 'error' in result ? result.error : 'resync'
    const attempts = result.attempts || 1 // allow for field to be absent
    const requests = result.requestCount || 0
    const queueSize = 'queueSize' in result ? result.queueSize : 0
    if (failureCounts[failureType] > 0) {
      failureCounts[failureType]++
      failureAttempts[failureType] += attempts
      failureRequests[failureType] += requests
      maxQueueSize[failureType] = Math.max(queueSize, maxQueueSize[failureType])
    } else {
      failureCounts[failureType] = 1
      failureAttempts[failureType] = attempts
      failureRequests[failureType] = requests
      maxQueueSize[failureType] = queueSize
    }
  }

  return { failureCounts, failureAttempts, failureRequests, maxQueueSize }
}

/**
 * Mapping between error messages and short labels.
 * @type {Record<string, string>}
 */
const SHORT_ERROR_NAMES = {
  'Error: bad response from filestore: 404': 'filestore-404',
  'Error: bad response from filestore: 500': 'filestore-500',
  'NotFoundError: got a 404 from web api': 'web-api-404',
  'Error: history store a non-success status code: 413': 'history-store-413',
  'Error: history store a non-success status code: 422': 'history-store-422',
  'Error: history store a non-success status code: 500': 'history-store-500',
  'Error: history store a non-success status code: 503': 'history-store-503',
  'Error: web returned a non-success status code: 500 (attempts: 2)': 'web-500',
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
  'UpdateWithUnknownFormatError: update with unknown format': 'unknown-format',
  'Error: update with unknown format': 'unknown-format',
  'TextOperationError: The base length of the second operation has to be the target length of the first operation':
    'text-op-error',
  'Error: ENOSPC: no space left on device, write': 'ENOSPC',
  '*': 'other',
}

async function getFailuresFull() {
  const results = []
  for await (const failure of await getFailedProjects()) {
    results.push({
      category:
        'error' in failure ? SHORT_ERROR_NAMES[failure.error] : undefined,
      ...failure,
    })
  }
  return results
}

async function getFailures() {
  const { failureCounts, failureAttempts, failureRequests, maxQueueSize } =
    await getFailuresByType()

  let attempts, failureType, label, requests

  // set all the known errors to zero if not present (otherwise gauges stay on their last value)
  const summaryCounts = {}
  const summaryAttempts = {}
  const summaryRequests = {}
  const summaryMaxQueueSize = {}

  for (failureType in SHORT_ERROR_NAMES) {
    label = SHORT_ERROR_NAMES[failureType]
    summaryCounts[label] = 0
    summaryAttempts[label] = 0
    summaryRequests[label] = 0
    summaryMaxQueueSize[label] = 0
  }

  // record a metric for each type of failure
  for (failureType in failureCounts) {
    const failureCount = failureCounts[failureType]
    label = SHORT_ERROR_NAMES[failureType] || SHORT_ERROR_NAMES['*']
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

  return {
    counts: summaryCounts,
    attempts: summaryAttempts,
    requests: summaryRequests,
    maxQueueSize: summaryMaxQueueSize,
  }
}

// EXPORTS

const getFailuresFullCb = callbackify(getFailuresFull)
const getFailedProjectsCb = callbackify(getFailedProjects)
const getFailureRecordCb = callbackify(getFailureRecord)
const getFailuresCb = callbackify(getFailures)
const cloneFailureCb = callbackify(cloneFailure)
const getLastFailureCb = callbackify(getLastFailure)
const recordCb = callbackify(record)
const clearErrorCb = callbackify(clearError)
const recordSyncStartCb = callbackify(recordSyncStart)
const setForceDebugCb = callbackify(setForceDebug)

export {
  cloneFailureCb as cloneFailure,
  getFailuresFullCb as getFailuresFull,
  getFailedProjectsCb as getFailedProjects,
  getFailureRecordCb as getFailureRecord,
  getLastFailureCb as getLastFailure,
  getFailuresCb as getFailures,
  recordCb as record,
  clearErrorCb as clearError,
  recordSyncStartCb as recordSyncStart,
  setForceDebugCb as setForceDebug,
}

export const promises = {
  getFailedProjects,
  cloneFailure,
  getFailureRecord,
  getLastFailure,
  getFailures,
  record,
  clearError,
  recordSyncStart,
  setForceDebug,
}
