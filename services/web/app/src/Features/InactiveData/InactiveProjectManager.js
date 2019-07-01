/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let InactiveProjectManager
const async = require('async')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const DocstoreManager = require('../Docstore/DocstoreManager')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectUpdateHandler = require('../Project/ProjectUpdateHandler')
const { Project } = require('../../models/Project')

const MILISECONDS_IN_DAY = 86400000
module.exports = InactiveProjectManager = {
  reactivateProjectIfRequired(project_id, callback) {
    return ProjectGetter.getProject(project_id, { active: true }, function(
      err,
      project
    ) {
      if (err != null) {
        logger.warn({ err, project_id }, 'error getting project')
        return callback(err)
      }
      logger.log(
        { project_id, active: project.active },
        'seeing if need to reactivate project'
      )

      if (project.active) {
        return callback()
      }

      return DocstoreManager.unarchiveProject(project_id, function(err) {
        if (err != null) {
          logger.warn(
            { err, project_id },
            'error reactivating project in docstore'
          )
          return callback(err)
        }
        return ProjectUpdateHandler.markAsActive(project_id, callback)
      })
    })
  },

  deactivateOldProjects(limit, daysOld, callback) {
    if (limit == null) {
      limit = 10
    }
    if (daysOld == null) {
      daysOld = 360
    }
    const oldProjectDate = new Date() - MILISECONDS_IN_DAY * daysOld
    logger.log(
      { oldProjectDate, limit, daysOld },
      'starting process of deactivating old projects'
    )
    return Project.find()
      .where('lastOpened')
      .lt(oldProjectDate)
      .where('active')
      .equals(true)
      .select('_id')
      .limit(limit)
      .exec(function(err, projects) {
        if (err != null) {
          logger.err({ err }, 'could not get projects for deactivating')
        }
        const jobs = _.map(projects, project => cb =>
          InactiveProjectManager.deactivateProject(project._id, cb)
        )
        logger.log(
          { numberOfProjects: projects != null ? projects.length : undefined },
          'deactivating projects'
        )
        return async.series(jobs, function(err) {
          if (err != null) {
            logger.warn({ err }, 'error deactivating projects')
          }
          return callback(err, projects)
        })
      })
  },

  deactivateProject(project_id, callback) {
    logger.log({ project_id }, 'deactivating inactive project')
    const jobs = [
      cb => DocstoreManager.archiveProject(project_id, cb),
      cb => ProjectUpdateHandler.markAsInactive(project_id, cb)
    ]
    return async.series(jobs, function(err) {
      if (err != null) {
        logger.warn({ err, project_id }, 'error deactivating project')
      }
      return callback(err)
    })
  }
}
