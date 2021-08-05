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
const OError = require('@overleaf/o-error')
const async = require('async')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const DocstoreManager = require('../Docstore/DocstoreManager')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectUpdateHandler = require('../Project/ProjectUpdateHandler')
const { Project } = require('../../models/Project')
const { ObjectId } = require('mongodb')

const MILISECONDS_IN_DAY = 86400000
module.exports = InactiveProjectManager = {
  reactivateProjectIfRequired(project_id, callback) {
    return ProjectGetter.getProject(
      project_id,
      { active: true },
      function (err, project) {
        if (err != null) {
          OError.tag(err, 'error getting project', {
            project_id,
          })
          return callback(err)
        }
        logger.log(
          { project_id, active: project.active },
          'seeing if need to reactivate project'
        )

        if (project.active) {
          return callback()
        }

        return DocstoreManager.unarchiveProject(project_id, function (err) {
          if (err != null) {
            OError.tag(err, 'error reactivating project in docstore', {
              project_id,
            })
            return callback(err)
          }
          return ProjectUpdateHandler.markAsActive(project_id, callback)
        })
      }
    )
  },

  deactivateOldProjects(limit, daysOld, callback) {
    if (limit == null) {
      limit = 10
    }
    if (daysOld == null) {
      daysOld = 360
    }
    const oldProjectDate = new Date() - MILISECONDS_IN_DAY * daysOld
    // use $not $gt to catch non-opened projects where lastOpened is null
    Project.find({ lastOpened: { $not: { $gt: oldProjectDate } } })
      .where('_id')
      .lt(ObjectId.createFromTime(oldProjectDate / 1000))
      .where('active')
      .equals(true)
      .select('_id')
      .sort({ _id: 1 })
      .limit(limit)
      .read('secondary')
      .exec(function (err, projects) {
        if (err != null) {
          logger.err({ err }, 'could not get projects for deactivating')
        }
        const jobs = _.map(projects, project => cb =>
          InactiveProjectManager.deactivateProject(project._id, function (err) {
            if (err) {
              logger.err(
                { project_id: project._id, err: err },
                'unable to deactivate project'
              )
            }
            cb()
          })
        )
        logger.log(
          { numberOfProjects: projects && projects.length },
          'deactivating projects'
        )
        async.series(jobs, function (err) {
          if (err != null) {
            logger.warn({ err }, 'error deactivating projects')
          }
          callback(err, projects)
        })
      })
  },

  deactivateProject(project_id, callback) {
    logger.log({ project_id }, 'deactivating inactive project')
    const jobs = [
      cb => DocstoreManager.archiveProject(project_id, cb),
      cb => ProjectUpdateHandler.markAsInactive(project_id, cb),
    ]
    return async.series(jobs, function (err) {
      if (err != null) {
        logger.warn({ err, project_id }, 'error deactivating project')
      }
      return callback(err)
    })
  },
}
