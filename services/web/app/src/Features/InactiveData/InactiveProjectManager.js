const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const DocstoreManager = require('../Docstore/DocstoreManager')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectUpdateHandler = require('../Project/ProjectUpdateHandler')
const { Project } = require('../../models/Project')
const { ObjectId } = require('mongodb-legacy')
const Modules = require('../../infrastructure/Modules')
const { READ_PREFERENCE_SECONDARY } = require('../../infrastructure/mongodb')
const { callbackifyAll } = require('@overleaf/promise-utils')
const Metrics = require('@overleaf/metrics')

const MILISECONDS_IN_DAY = 86400000
const InactiveProjectManager = {
  async reactivateProjectIfRequired(projectId) {
    let project
    try {
      project = await ProjectGetter.promises.getProject(projectId, {
        active: true,
      })
    } catch (err) {
      OError.tag(err, 'error getting project', {
        project_id: projectId,
      })
      throw err
    }

    logger.debug(
      { projectId, active: project.active },
      'seeing if need to reactivate project'
    )

    if (project.active) {
      return
    }

    try {
      await DocstoreManager.promises.unarchiveProject(projectId)
    } catch (err) {
      OError.tag(err, 'error reactivating project in docstore', {
        project_id: projectId,
      })
      throw err
    }

    await ProjectUpdateHandler.promises.markAsActive(projectId)
  },

  async deactivateOldProjects(limit, daysOld) {
    if (limit == null) {
      limit = 10
    }
    if (daysOld == null) {
      daysOld = 360
    }
    const oldProjectDate = new Date() - MILISECONDS_IN_DAY * daysOld

    let projects
    try {
      // use $not $gt to catch non-opened projects where lastOpened is null
      projects = await Project.find({
        lastOpened: { $not: { $gt: oldProjectDate } },
      })
        .where('_id')
        .lt(ObjectId.createFromTime(oldProjectDate / 1000))
        .where('active')
        .equals(true)
        .select('_id')
        .limit(limit)
        .read(READ_PREFERENCE_SECONDARY)
        .exec()
    } catch (err) {
      logger.err({ err }, 'could not get projects for deactivating')
    }

    logger.debug(
      { numberOfProjects: projects && projects.length },
      'deactivating projects'
    )

    for (const project of projects) {
      try {
        await InactiveProjectManager.deactivateProject(project._id)
      } catch (err) {
        logger.err(
          { projectId: project._id, err },
          'unable to deactivate project'
        )
      }
    }

    return projects
  },

  async deactivateProject(projectId) {
    logger.debug({ projectId }, 'deactivating inactive project')

    // ensure project is removed from document updater (also flushes updates to history)
    try {
      await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(
        projectId
      )
    } catch (err) {
      logger.warn(
        { err, projectId },
        'error flushing project to mongo when archiving'
      )
      Metrics.inc('inactive-project', 1, {
        method: 'archive',
        status: 'flush-error',
      })
      throw err
    }

    await Modules.promises.hooks.fire('deactivateProject', projectId)

    // now archive the project and mark it as inactive
    try {
      await DocstoreManager.promises.archiveProject(projectId)
      await ProjectUpdateHandler.promises.markAsInactive(projectId)
    } catch (err) {
      logger.warn({ err, projectId }, 'error deactivating project')
      throw err
    }
  },
}

module.exports = {
  ...callbackifyAll(InactiveProjectManager),
  promises: InactiveProjectManager,
}
