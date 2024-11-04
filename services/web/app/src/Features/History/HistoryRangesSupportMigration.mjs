// @ts-check

import { callbackify } from 'node:util'
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import HistoryManager from '../History/HistoryManager.js'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.js'
import DocstoreManager from '../Docstore/DocstoreManager.js'
import ProjectOptionsHandler from '../Project/ProjectOptionsHandler.js'
import mongodb from '../../infrastructure/mongodb.js'

const { db, ObjectId, READ_PREFERENCE_SECONDARY } = mongodb

/**
 * Migrate projects based on a query.
 *
 * @param {object} opts
 * @param {string[]} [opts.projectIds]
 * @param {string[]} [opts.ownerIds]
 * @param {string} [opts.minId]
 * @param {string} [opts.maxId]
 * @param {number} [opts.maxCount]
 * @param {"forwards" | "backwards"} [opts.direction]
 * @param {boolean} [opts.force]
 * @param {boolean} [opts.stopOnError]
 * @param {boolean} [opts.quickOnly]
 * @param {number} [opts.concurrency]
 */
async function migrateProjects(opts = {}) {
  const {
    ownerIds,
    projectIds,
    minId,
    maxId,
    maxCount = Infinity,
    direction = 'forwards',
    force = false,
    stopOnError = false,
    quickOnly = false,
    concurrency = 1,
  } = opts

  const clauses = []

  // skip projects that don't have full project history
  clauses.push({ 'overleaf.history.id': { $exists: true } })

  if (projectIds != null) {
    clauses.push({ _id: { $in: projectIds.map(id => new ObjectId(id)) } })
  }
  if (ownerIds != null) {
    clauses.push({ owner_ref: { $in: ownerIds.map(id => new ObjectId(id)) } })
  }
  if (minId) {
    clauses.push({ _id: { $gte: new ObjectId(minId) } })
  }
  if (maxId) {
    clauses.push({ _id: { $lte: new ObjectId(maxId) } })
  }

  const filter = {}
  if (clauses.length > 0) {
    filter.$and = clauses
  }

  const projects = db.projects
    .find(filter, {
      readPreference: READ_PREFERENCE_SECONDARY,
      projection: { _id: 1, overleaf: 1 },
    })
    .sort({ _id: -1 })

  let terminating = false
  const handleSignal = signal => {
    logger.info({ signal }, 'History ranges support migration received signal')
    terminating = true
  }
  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)

  const projectsProcessed = {
    quick: 0,
    skipped: 0,
    resync: 0,
    total: 0,
  }
  const jobsByProjectId = new Map()
  let errors = 0

  for await (const project of projects) {
    if (projectsProcessed.total >= maxCount) {
      break
    }

    if (errors > 0 && stopOnError) {
      break
    }

    if (terminating) {
      break
    }

    const projectId = project._id.toString()

    if (!force) {
      // Skip projects that are already migrated
      if (
        (direction === 'forwards' &&
          project.overleaf.history.rangesSupportEnabled) ||
        (direction === 'backwards' &&
          !project.overleaf.history.rangesSupportEnabled)
      ) {
        continue
      }
    }

    if (jobsByProjectId.size >= concurrency) {
      // Wait until the next job finishes
      await Promise.race(jobsByProjectId.values())
    }

    const job = processProject(projectId, direction, quickOnly)
      .then(info => {
        jobsByProjectId.delete(projectId)
        projectsProcessed[info.migrationType] += 1
        projectsProcessed.total += 1
        logger.debug(
          {
            projectId,
            direction,
            projectsProcessed,
            errors,
            ...info,
          },
          'History ranges support migration'
        )
        if (projectsProcessed.total % 10000 === 0) {
          logger.info(
            { projectsProcessed, errors, lastProjectId: projectId },
            'History ranges support migration progress'
          )
        }
      })
      .catch(err => {
        jobsByProjectId.delete(projectId)
        errors += 1
        logger.error(
          { err, projectId, direction, projectsProcessed, errors },
          'Failed to migrate history ranges support'
        )
      })

    jobsByProjectId.set(projectId, job)
  }

  // Let the last jobs finish
  await Promise.all(jobsByProjectId.values())
}

/**
 * Migrate a single project
 *
 * @param {string} projectId
 * @param {"forwards" | "backwards"} direction
 * @param {boolean} quickOnly
 */
async function processProject(projectId, direction, quickOnly) {
  const startTimeMs = Date.now()
  const quickMigrationSuccess = await quickMigration(projectId, direction)
  let migrationType
  if (quickMigrationSuccess) {
    migrationType = 'quick'
  } else if (quickOnly) {
    migrationType = 'skipped'
  } else {
    await migrateProject(projectId, direction)
    migrationType = 'resync'
  }
  const elapsedMs = Date.now() - startTimeMs
  return { migrationType, elapsedMs }
}

/**
 * Attempt a quick migration (without resync)
 *
 * @param {string} projectId
 * @param {"forwards" | "backwards"} direction
 * @return {Promise<boolean>} whether or not the quick migration was a success
 */
async function quickMigration(projectId, direction = 'forwards') {
  const blockSuccess =
    await DocumentUpdaterHandler.promises.blockProject(projectId)
  if (!blockSuccess) {
    return false
  }

  let projectHasRanges
  try {
    projectHasRanges =
      await DocstoreManager.promises.projectHasRanges(projectId)
  } catch (err) {
    // Docstore request probably timed out. Assume the project has ranges
    logger.warn(
      { err, projectId },
      'Failed to check if project has ranges; proceeding with a resync migration'
    )
    projectHasRanges = true
  }
  if (projectHasRanges) {
    await DocumentUpdaterHandler.promises.unblockProject(projectId)
    return false
  }

  try {
    await ProjectOptionsHandler.promises.setHistoryRangesSupport(
      projectId,
      direction === 'forwards'
    )
  } catch (err) {
    await DocumentUpdaterHandler.promises.unblockProject(projectId)
    await hardResyncProject(projectId)
    throw err
  }

  let wasBlocked
  try {
    wasBlocked = await DocumentUpdaterHandler.promises.unblockProject(projectId)
  } catch (err) {
    await hardResyncProject(projectId)
    throw err
  }
  if (!wasBlocked) {
    await hardResyncProject(projectId)
    throw new OError('Tried to unblock project but it was not blocked', {
      projectId,
    })
  }

  return true
}

/**
 * Migrate a single project
 *
 * @param {string} projectId
 * @param {"forwards" | "backwards"} direction
 */
async function migrateProject(projectId, direction = 'forwards') {
  await HistoryManager.promises.flushProject(projectId)
  await HistoryManager.promises.resyncProject(projectId, {
    historyRangesMigration: direction,
  })
}

/**
 * Hard resync a project
 *
 * This is used when something goes wrong with the quick migration after we've
 * changed the history ranges support flag on a project.
 *
 * @param {string} projectId
 */
async function hardResyncProject(projectId) {
  await HistoryManager.promises.flushProject(projectId)
  await HistoryManager.promises.resyncProject(projectId, { force: true })
}

export default {
  migrateProjects: callbackify(migrateProjects),
  migrateProject: callbackify(migrateProject),
  promises: { migrateProjects, migrateProject },
}
