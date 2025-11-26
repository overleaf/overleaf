import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectUpdateHandler from '../Project/ProjectUpdateHandler.mjs'
import { Project } from '../../models/Project.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import { READ_PREFERENCE_SECONDARY } from '../../infrastructure/mongodb.mjs'
import { callbackifyAll } from '@overleaf/promise-utils'
import Metrics from '@overleaf/metrics'

const MILISECONDS_IN_DAY = 86400000

function findInactiveProjects(limit, daysOld) {
  const oldProjectDate = new Date() - MILISECONDS_IN_DAY * daysOld
  try {
    // use $not $gt to catch non-opened projects where lastOpened is null
    // return a cursor instead of executing the query
    return Project.find({
      lastOpened: { $not: { $gt: oldProjectDate } },
    })
      .where('active')
      .equals(true)
      .select(['_id', 'lastOpened'])
      .limit(limit)
      .read(READ_PREFERENCE_SECONDARY)
      .cursor()
  } catch (err) {
    logger.err({ err }, 'could not get projects for deactivating')
    throw err // Re-throw the error to be handled by the caller
  }
}

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

    logger.debug('deactivating projects')

    const processedProjects = []

    for await (const project of findInactiveProjects(limit, daysOld)) {
      processedProjects.push(project)
      try {
        await InactiveProjectManager.deactivateProject(project._id)
      } catch (err) {
        logger.err(
          { projectId: project._id, err },
          'unable to deactivate project'
        )
      }
    }

    logger.debug(
      { numberOfProjects: processedProjects.length },
      'finished deactivating projects'
    )

    return processedProjects
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

export default {
  ...callbackifyAll(InactiveProjectManager),
  promises: InactiveProjectManager,
  findInactiveProjects,
}
