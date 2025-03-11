// @ts-check
import {
  BackupCorruptedError,
  BackupCorruptedInvalidBlobError,
  BackupCorruptedMissingBlobError,
  BackupRPOViolationChunkNotBackedUpError,
  BackupRPOViolationError,
  verifyProjectWithErrorContext,
} from '../storage/lib/backupVerifier.mjs'
import { promiseMapSettledWithLimit } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import {
  getSampleProjectsCursor,
  selectProjectsInDateRange,
} from './ProjectSampler.mjs'
import OError from '@overleaf/o-error'

const MS_PER_30_DAYS = 30 * 24 * 60 * 60 * 1000

const METRICS = {
  backup_project_verification_failed: 'backup_project_verification_failed',
  backup_project_verification_succeeded:
    'backup_project_verification_succeeded',
}

let WRITE_METRICS = false

/**
 * Allows writing metrics to be enabled or disabled.
 * @param {Boolean} writeMetrics
 */
export function setWriteMetrics(writeMetrics) {
  WRITE_METRICS = writeMetrics
}

/**
 *
 * @param {Error|unknown} error
 * @param {string} historyId
 */
function handleVerificationError(error, historyId) {
  const name = error instanceof Error ? error.name : 'UnknownError'
  logger.error({ historyId, error, name }, 'error verifying project backup')

  WRITE_METRICS &&
    metrics.inc(METRICS.backup_project_verification_failed, 1, { name })

  return name
}

/**
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} interval
 * @returns {Array<VerificationJobSpecification>}
 */
function splitJobs(startDate, endDate, interval) {
  /** @type {Array<VerificationJobSpecification>} */
  const jobs = []
  while (startDate < endDate) {
    const nextStart = new Date(
      Math.min(startDate.getTime() + interval, endDate.getTime())
    )
    jobs.push({ startDate, endDate: nextStart })
    startDate = nextStart
  }
  return jobs
}

/**
 *
 * @param {Array<string>} historyIds
 * @return {Promise<VerificationJobStatus>}
 */
async function verifyProjects(historyIds) {
  let verified = 0
  const errorTypes = []
  for (const historyId of historyIds) {
    try {
      await verifyProjectWithErrorContext(historyId)
      logger.debug({ historyId }, 'verified project backup successfully')
      WRITE_METRICS &&
        metrics.inc(METRICS.backup_project_verification_succeeded)
      verified++
    } catch (error) {
      errorTypes.push(handleVerificationError(error, historyId))
    }
  }
  return {
    verified,
    errorTypes,
    hasFailure: errorTypes.length > 0,
    total: historyIds.length,
  }
}

/**
 *
 * @param {number} nProjectsToSample
 * @return {Promise<VerificationJobStatus>}
 */
export async function verifyRandomProjectSample(nProjectsToSample) {
  const historyIds = await getSampleProjectsCursor(nProjectsToSample)

  const errorTypes = []
  let verified = 0
  let total = 0
  for await (const historyId of historyIds) {
    total++
    try {
      await verifyProjectWithErrorContext(historyId)
      logger.debug({ historyId }, 'verified project backup successfully')
      WRITE_METRICS &&
        metrics.inc(METRICS.backup_project_verification_succeeded)
      verified++
    } catch (error) {
      errorTypes.push(handleVerificationError(error, historyId))
    }
  }
  return {
    verified,
    total,
    errorTypes,
    hasFailure: errorTypes.length > 0,
  }
}

/**
 * Samples projects with history IDs between the specified dates and verifies them.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} projectsPerRange
 * @return {Promise<VerificationJobStatus>}
 */
async function verifyRange(startDate, endDate, projectsPerRange) {
  logger.info({ startDate, endDate }, 'verifying range')
  const historyIds = await selectProjectsInDateRange(
    startDate,
    endDate,
    projectsPerRange
  )
  if (historyIds.length === 0) {
    logger.debug(
      { start: startDate, end: endDate },
      'No projects found in range'
    )
    return {
      startDate,
      endDate,
      verified: 0,
      total: 0,
      hasFailure: false,
      errorTypes: [],
    }
  }
  logger.debug(
    { startDate, endDate, total: historyIds.length },
    'Verifying projects in range'
  )

  const { errorTypes, hasFailure, verified } = await verifyProjects(historyIds)

  const jobStatus = {
    verified,
    total: historyIds.length,
    hasFailure,
    startDate,
    endDate,
    errorTypes,
  }

  logger.debug(jobStatus, 'verified range')
  return jobStatus
}

/**
 * @typedef {Object} VerificationJobSpecification
 * @property {Date} startDate
 * @property {Date} endDate
 */

/**
 * @typedef {import('./types.d.ts').VerificationJobStatus} VerificationJobStatus
 */

/**
 * @typedef {Object} VerifyDateRangeOptions
 * @property {Date} startDate
 * @property {Date} endDate
 * @property {number} [interval]
 * @property {number} [projectsPerRange]
 * @property {number} [concurrency]
 */

/**
 *
 * @param {VerifyDateRangeOptions} options
 * @return {Promise<VerificationJobStatus>}
 */
export async function verifyProjectsInDateRange({
  concurrency = 0,
  projectsPerRange = 10,
  startDate,
  endDate,
  interval = MS_PER_30_DAYS,
}) {
  const jobs = splitJobs(startDate, endDate, interval)
  if (jobs.length === 0) {
    throw new OError('Time range could not be split into jobs', {
      start: startDate,
      end: endDate,
      interval,
    })
  }
  const settlements = await promiseMapSettledWithLimit(
    concurrency,
    jobs,
    ({ startDate, endDate }) =>
      verifyRange(startDate, endDate, projectsPerRange)
  )
  return settlements.reduce(
    /**
     *
     * @param {VerificationJobStatus} acc
     * @param settlement
     * @return {VerificationJobStatus}
     */
    (acc, settlement) => {
      if (settlement.status !== 'rejected') {
        if (settlement.value.hasFailure) {
          acc.hasFailure = true
        }
        acc.total += settlement.value.total
        acc.verified += settlement.value.verified
        acc.errorTypes = acc.errorTypes.concat(settlement.value.errorTypes)
      } else {
        logger.error({ ...settlement.reason }, 'Error processing range')
      }
      return acc
    },
    /** @type {VerificationJobStatus} */
    {
      startDate,
      endDate,
      verified: 0,
      total: 0,
      hasFailure: false,
      errorTypes: [],
    }
  )
}
