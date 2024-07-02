// @ts-check

const { callbackify } = require('util')
const { ObjectId } = require('mongodb')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const HistoryManager = require('../History/HistoryManager')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const DocstoreManager = require('../Docstore/DocstoreManager')
const ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
const { db } = require('../../infrastructure/mongodb')

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
  } = opts

  const clauses = []
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
      projection: { _id: 1, overleaf: 1 },
    })
    .sort({ _id: -1 })

  let projectsProcessed = 0
  for await (const project of projects) {
    if (projectsProcessed >= maxCount) {
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

    const startTimeMs = Date.now()
    let quickMigrationSuccess
    try {
      quickMigrationSuccess = await quickMigration(projectId, direction)
      if (!quickMigrationSuccess) {
        if (quickOnly) {
          logger.info(
            { projectId, direction },
            'Quick migration failed, skipping project'
          )
        } else {
          await migrateProject(projectId, direction)
        }
      }
    } catch (err) {
      logger.error(
        { err, projectId, direction, projectsProcessed },
        'Failed to migrate history ranges support'
      )
      projectsProcessed += 1
      if (stopOnError) {
        break
      } else {
        continue
      }
    }
    const elapsedMs = Date.now() - startTimeMs
    projectsProcessed += 1
    logger.info(
      {
        projectId,
        direction,
        projectsProcessed,
        elapsedMs,
        quick: quickMigrationSuccess,
      },
      'Migrated history ranges support'
    )
  }
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
    await DocumentUpdaterHandler.promises.unblockProject(projectId)
    throw err
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

module.exports = {
  migrateProjects: callbackify(migrateProjects),
  migrateProject: callbackify(migrateProject),
  promises: { migrateProjects, migrateProject },
}
