// @ts-check

const { callbackify } = require('util')
const { ObjectId } = require('mongodb')
const logger = require('@overleaf/logger')
const HistoryManager = require('../History/HistoryManager')
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
    try {
      await migrateProject(projectId, direction)
    } catch (err) {
      logger.error(
        { projectId, direction, projectsProcessed },
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
      { projectId, direction, projectsProcessed, elapsedMs },
      'Migrated history ranges support'
    )
  }
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

module.exports = {
  migrateProjects: callbackify(migrateProjects),
  migrateProject: callbackify(migrateProject),
  promises: { migrateProjects, migrateProject },
}
