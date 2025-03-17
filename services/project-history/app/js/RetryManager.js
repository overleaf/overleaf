import _ from 'lodash'
import { promisify, callbackify } from 'node:util'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import * as UpdatesProcessor from './UpdatesProcessor.js'
import * as SyncManager from './SyncManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as RedisManager from './RedisManager.js'
import * as ErrorRecorder from './ErrorRecorder.js'

const sleep = promisify(setTimeout)

const TEMPORARY_FAILURES = [
  'Error: ENOSPC: no space left on device, write',
  'Error: ESOCKETTIMEDOUT',
  'Error: failed to extend lock',
  'Error: tried to release timed out lock',
  'Error: Timeout',
]

const HARD_FAILURES = [
  'Error: history store a non-success status code: 422',
  'OError: history store a non-success status code: 422',
  'OpsOutOfOrderError: project structure version out of order',
  'OpsOutOfOrderError: project structure version out of order on incoming updates',
  'OpsOutOfOrderError: doc version out of order',
  'OpsOutOfOrderError: doc version out of order on incoming updates',
]

const MAX_RESYNC_ATTEMPTS = 2
const MAX_SOFT_RESYNC_ATTEMPTS = 1

export const promises = {}

promises.retryFailures = async (options = {}) => {
  const { failureType, timeout, limit } = options
  if (failureType === 'soft') {
    const batch = await getFailureBatch(softErrorSelector, limit)
    const result = await retryFailureBatch(batch, timeout, async failure => {
      await UpdatesProcessor.promises.processUpdatesForProject(
        failure.project_id
      )
    })
    return result
  } else if (failureType === 'hard') {
    const batch = await getFailureBatch(hardErrorSelector, limit)
    const result = await retryFailureBatch(batch, timeout, async failure => {
      await resyncProject(failure.project_id, {
        hard: failureRequiresHardResync(failure),
      })
    })
    return result
  }
}

export const retryFailures = callbackify(promises.retryFailures)

function softErrorSelector(failure) {
  return (
    (isTemporaryFailure(failure) && !isRepeatedFailure(failure)) ||
    (isFirstFailure(failure) && !isHardFailure(failure))
  )
}

function hardErrorSelector(failure) {
  return (
    (isHardFailure(failure) || isRepeatedFailure(failure)) &&
    !isStuckFailure(failure)
  )
}

function isTemporaryFailure(failure) {
  return TEMPORARY_FAILURES.includes(failure.error)
}

export function isHardFailure(failure) {
  return HARD_FAILURES.includes(failure.error)
}

export function isFirstFailure(failure) {
  return failure.attempts <= 1
}

function isRepeatedFailure(failure) {
  return failure.attempts > 3
}

function isStuckFailure(failure) {
  return (
    failure.resyncAttempts != null &&
    failure.resyncAttempts >= MAX_RESYNC_ATTEMPTS
  )
}

function failureRequiresHardResync(failure) {
  return (
    failure.resyncAttempts != null &&
    failure.resyncAttempts >= MAX_SOFT_RESYNC_ATTEMPTS
  )
}

async function getFailureBatch(selector, limit) {
  let failures = await ErrorRecorder.promises.getFailedProjects()
  failures = failures.filter(selector)
  // randomise order
  failures = _.shuffle(failures)

  // put a limit on the number to retry
  const projectsToRetryCount = failures.length
  if (limit && projectsToRetryCount > limit) {
    failures = failures.slice(0, limit)
  }
  logger.debug({ projectsToRetryCount, limit }, 'retrying failed projects')
  return failures
}

async function retryFailureBatch(failures, timeout, retryHandler) {
  const startTime = new Date()

  // keep track of successes and failures
  const failed = []
  const succeeded = []
  for (const failure of failures) {
    const projectId = failure.project_id
    const timeTaken = new Date() - startTime
    if (timeout && timeTaken > timeout) {
      // finish early due to timeout
      logger.debug('background retries timed out')
      break
    }
    logger.debug(
      { projectId, timeTaken },
      'retrying failed project in background'
    )
    try {
      await retryHandler(failure)
      succeeded.push(projectId)
    } catch (err) {
      failed.push(projectId)
    }
  }
  return { succeeded, failed }
}

async function resyncProject(projectId, options = {}) {
  const { hard = false } = options
  try {
    if (!/^[0-9a-f]{24}$/.test(projectId)) {
      logger.debug({ projectId }, 'clearing bad project id')
      await ErrorRecorder.promises.clearError(projectId)
      return
    }

    await checkProjectHasHistoryId(projectId)
    if (hard) {
      await SyncManager.promises.startHardResync(projectId)
    } else {
      await SyncManager.promises.startResync(projectId)
    }
    await waitUntilRedisQueueIsEmpty(projectId)
    await checkFailureRecordWasRemoved(projectId)
  } catch (err) {
    throw new OError({
      message: 'failed to resync project',
      info: { projectId, hard },
    }).withCause(err)
  }
}

async function checkProjectHasHistoryId(projectId) {
  const historyId = await WebApiManager.promises.getHistoryId(projectId)
  if (historyId == null) {
    throw new OError('no history id')
  }
}

async function waitUntilRedisQueueIsEmpty(projectId) {
  for (let attempts = 0; attempts < 30; attempts++) {
    const updatesCount =
      await RedisManager.promises.countUnprocessedUpdates(projectId)
    if (updatesCount === 0) {
      return
    }
    await sleep(1000)
  }
  throw new OError('queue not empty')
}

async function checkFailureRecordWasRemoved(projectId) {
  const failureRecord = await ErrorRecorder.promises.getFailureRecord(projectId)
  if (failureRecord) {
    throw new OError('failure record still exists')
  }
}
