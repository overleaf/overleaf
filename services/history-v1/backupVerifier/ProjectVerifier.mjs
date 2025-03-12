// @ts-check
import { verifyProjectWithErrorContext } from '../storage/lib/backupVerifier.mjs'
import { promiseMapSettledWithLimit } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import {
  getSampleProjectsCursor,
  getProjectsCreatedInDateRangeCursor,
  getProjectsUpdatedInDateRangeCursor,
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
 * @param historyIdCursor
 * @return {Promise<{verified: number, total: number, errorTypes: *[], hasFailure: boolean}>}
 */
async function verifyProjectsFromCursor(historyIdCursor) {
  const errorTypes = []
  let verified = 0
  let total = 0
  for await (const historyId of historyIdCursor) {
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
 *
 * @param {number} nProjectsToSample
 * @return {Promise<VerificationJobStatus>}
 */
export async function verifyRandomProjectSample(nProjectsToSample) {
  const historyIds = await getSampleProjectsCursor(nProjectsToSample)
  return await verifyProjectsFromCursor(historyIds)
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

  const results = await verifyProjectsFromCursor(
    getProjectsCreatedInDateRangeCursor(startDate, endDate, projectsPerRange)
  )

  if (results.total === 0) {
    logger.debug(
      { start: startDate, end: endDate },
      'No projects found in range'
    )
  }

  const jobStatus = {
    ...results,
    startDate,
    endDate,
  }

  logger.debug(
    { ...jobStatus, errorTypes: Array.from(new Set(jobStatus.errorTypes)) },
    'Verified range'
  )
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
export async function verifyProjectsCreatedInDateRange({
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

/**
 * Verifies that projects that have recently gone out of RPO have been updated.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} nProjects
 * @return {Promise<VerificationJobStatus>}
 */
export async function verifyProjectsUpdatedInDateRange(
  startDate,
  endDate,
  nProjects
) {
  logger.debug(
    { startDate, endDate, nProjects },
    'Sampling projects updated in date range'
  )
  const results = await verifyProjectsFromCursor(
    getProjectsUpdatedInDateRangeCursor(startDate, endDate, nProjects)
  )

  if (results.total === 0) {
    logger.debug(
      { start: startDate, end: endDate },
      'No projects updated recently'
    )
  }

  const jobStatus = {
    ...results,
    startDate,
    endDate,
  }

  logger.debug(
    { ...jobStatus, errorTypes: Array.from(new Set(jobStatus.errorTypes)) },
    'Verified recently updated projects'
  )
  return jobStatus
}
